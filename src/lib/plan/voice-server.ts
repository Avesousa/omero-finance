/**
 * Carga por voz — interpretación en el servidor (transcribe + extrae con OpenAI).
 * Solo servidor. El cliente de OpenAI es inyectable para los tests.
 */

import {
  VOICE_EXTRACTION_SCHEMA, resolveVoiceOutcome, voiceSystemPrompt,
  type VoiceApiError, type VoiceContext, type VoiceExtraction, type VoiceOutcome,
} from "./voice";

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";
export const EXTRACT_MODEL = "gpt-4o-mini";

/** Parte del SDK de `openai` que usamos (permite inyectar un mock). */
export interface OpenAILike {
  audio: { transcriptions: { create(params: any): Promise<{ text: string }> } };
  chat: {
    completions: {
      create(params: any): Promise<{ choices: { message: { content: string | null } }[] }>;
    };
  };
}

export interface VoiceDeps {
  openai?: OpenAILike;
  /** Observador opcional de la respuesta cruda del modelo (diagnóstico; no altera el resultado). */
  onExtraction?: (raw: VoiceExtraction) => void;
}

export interface VoiceInput {
  audio?: Blob | null;
  text?: string | null;
}

export class VoiceError extends Error {
  constructor(
    message: string,
    public code: VoiceApiError["code"],
    public retryable: boolean,
  ) {
    super(message);
    this.name = "VoiceError";
  }
}

const PUBLIC_MESSAGE: Record<VoiceApiError["code"], string> = {
  not_configured: "La carga por voz no está configurada",
  provider_unavailable: "El servicio de voz no está disponible ahora",
  bad_audio: "No pude leer el audio",
  interpretation_failed: "No pude interpretar lo que dijiste",
  transcription_failed: "No pude transcribir el audio",
  internal: "Error interno",
};

/** Cuerpo de respuesta de la API para un `VoiceError`. */
export function toVoiceApiError(err: VoiceError, reported: boolean): VoiceApiError {
  return { error: PUBLIC_MESSAGE[err.code], code: err.code, retryable: err.retryable, reported };
}

/** Los no reintentables, salvo audio malo (culpa del usuario), se registran para el admin. */
export function shouldReport(err: VoiceError): boolean {
  return !err.retryable && err.code !== "bad_audio";
}

/** Clasifica un error del SDK (por forma, sin instanceof, para que sirva con mocks). */
export function classifyProviderError(err: unknown, stage: "transcribe" | "extract"): VoiceError {
  if (err instanceof VoiceError) return err;
  const e = err as { status?: number; code?: string; name?: string; message?: string } | null;
  const status = typeof e?.status === "number" ? e.status : undefined;
  const msg = e?.message ? String(e.message) : "error desconocido";
  const name = e?.name ?? "";
  if (status === undefined) {
    const netCodes = ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"];
    if (/Connection|Timeout|Abort/i.test(name) || (e?.code && netCodes.includes(e.code))) {
      return new VoiceError(`openai ${stage}: red/timeout (${msg})`, "provider_unavailable", true);
    }
    return new VoiceError(`openai ${stage}: ${msg}`, "internal", false);
  }
  if (status === 429 && e?.code === "insufficient_quota") {
    return new VoiceError(`openai ${stage}: sin cuota (${msg})`, "internal", false);
  }
  if (status === 408 || status === 409 || status === 429 || status >= 500) {
    return new VoiceError(`openai ${stage}: ${status} (${msg})`, "provider_unavailable", true);
  }
  if (status === 401 || status === 403) {
    return new VoiceError(`openai ${stage}: credenciales rechazadas (${status})`, "not_configured", false);
  }
  if (stage === "transcribe" && (status === 400 || status === 413 || status === 415 || status === 422)) {
    return new VoiceError(`openai transcribe: audio rechazado (${status}: ${msg})`, "bad_audio", false);
  }
  return new VoiceError(`openai ${stage}: ${status} (${msg})`, "internal", false);
}

async function defaultClient(): Promise<OpenAILike> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new VoiceError("Falta OPENAI_API_KEY", "not_configured", false);
  const { default: OpenAI } = await import("openai");
  return new OpenAI({ apiKey, timeout: 25_000, maxRetries: 0 }) as unknown as OpenAILike;
}

const EXT: [RegExp, string][] = [
  [/m4a|mp4|aac/, "m4a"], [/webm/, "webm"], [/wav/, "wav"], [/mpeg|mp3/, "mp3"], [/ogg/, "ogg"], [/flac/, "flac"],
];

function toFile(audio: Blob): File {
  const type = audio.type || "audio/m4a";
  const ext = EXT.find(([re]) => re.test(type))?.[1] ?? "m4a";
  const existing = (audio as File).name;
  return new File([audio], existing || `audio.${ext}`, { type });
}

async function transcribe(openai: OpenAILike, audio: Blob): Promise<string> {
  if (!audio.size) throw new VoiceError("Audio vacío", "bad_audio", false);
  if (audio.size > MAX_AUDIO_BYTES) throw new VoiceError("Audio demasiado grande", "bad_audio", false);
  try {
    const res = await openai.audio.transcriptions.create({
      model: TRANSCRIBE_MODEL, file: toFile(audio), language: "es",
    });
    return String(res?.text ?? "").trim();
  } catch (err) {
    throw classifyProviderError(err, "transcribe");
  }
}

async function extract(openai: OpenAILike, transcript: string, ctx: VoiceContext): Promise<VoiceExtraction> {
  const attempt = async (): Promise<VoiceExtraction> => {
    let content: string | null | undefined;
    try {
      const res = await openai.chat.completions.create({
        model: EXTRACT_MODEL,
        temperature: 0,
        response_format: { type: "json_schema", json_schema: VOICE_EXTRACTION_SCHEMA },
        messages: [
          { role: "system", content: voiceSystemPrompt(ctx) },
          { role: "user", content: transcript },
        ],
      });
      content = res?.choices?.[0]?.message?.content;
    } catch (err) {
      throw classifyProviderError(err, "extract");
    }
    try {
      const parsed = JSON.parse(content ?? "") as VoiceExtraction;
      if (!parsed || typeof parsed.intent !== "string") throw new Error("sin intent");
      return parsed;
    } catch {
      throw new VoiceError("El modelo devolvió un JSON inválido", "interpretation_failed", true);
    }
  };
  try {
    return await attempt();
  } catch (err) {
    // JSON inválido: se reintenta una vez acá mismo (los errores del proveedor los reintenta la app).
    if (err instanceof VoiceError && err.code === "interpretation_failed") return attempt();
    throw err;
  }
}

/**
 * Audio o texto → `VoiceOutcome`. Lanza `VoiceError` clasificado.
 * No guarda nada: el usuario siempre confirma el formulario.
 */
export async function interpretVoice(
  input: VoiceInput,
  ctx: VoiceContext,
  deps: VoiceDeps = {},
): Promise<VoiceOutcome> {
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!input.audio && !text) throw new VoiceError("Falta el audio o el texto", "bad_audio", false);

  const openai = deps.openai ?? (await defaultClient());
  const transcript = input.audio ? await transcribe(openai, input.audio) : text.slice(0, 2000);
  if (!transcript) return resolveVoiceOutcome("", null, ctx);

  const extraction = await extract(openai, transcript, ctx);
  deps.onExtraction?.(extraction);
  return resolveVoiceOutcome(transcript, extraction, ctx);
}
