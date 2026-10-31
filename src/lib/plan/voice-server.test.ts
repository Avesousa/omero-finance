import {
  MAX_AUDIO_BYTES, VoiceError, decodeAudioJson, classifyProviderError, interpretVoice, shouldReport, toVoiceApiError,
  type OpenAILike,
} from "./voice-server";
import type { VoiceContext } from "./voice";

const ctx: VoiceContext = { today: "2026-10-30", incomeCategories: [{ id: "c1", name: "Sueldo" }], expenseCategories: [{ id: "e1", name: "Supermercado" }] };

const extraction = (over: object = {}) => JSON.stringify({
  intent: "income",
  entry: { name: "Sueldo", amount: 1200000, currency: "ARS", categoryName: "sueldo", date: null, fixed: true, frequency: "MONTHLY", note: null, ...over },
});

function mock(opts: { text?: string; chat?: (n: number) => unknown } = {}) {
  const transcribe = jest.fn(async () => ({ text: opts.text ?? "Cobré el sueldo, un palo doscientos" }));
  let n = 0;
  const complete = jest.fn(async () => {
    const r = (opts.chat ?? (() => extraction()))(n++);
    return { choices: [{ message: { content: r as string } }] };
  });
  const openai: OpenAILike = { audio: { transcriptions: { create: transcribe } }, chat: { completions: { create: complete } } };
  return { openai, transcribe, complete };
}

const audio = (size = 100, type = "audio/m4a") => new Blob([new Uint8Array(size)], { type });
const httpErr = (status: number, extra: object = {}) => Object.assign(new Error(`http ${status}`), { status, ...extra });

describe("interpretVoice", () => {
  it("audio: transcribe y extrae con los modelos y parámetros esperados", async () => {
    const m = mock();
    const out = await interpretVoice({ audio: audio() }, ctx, { openai: m.openai });
    expect(out).toMatchObject({
      kind: "draft", intent: "income", transcript: "Cobré el sueldo, un palo doscientos",
      draft: { kind: "INCOME", amount: 1200000, categoryId: "c1", fixed: { frequency: "MONTHLY" } },
    });
    const t = m.transcribe.mock.calls[0] as unknown as [{ model: string; language: string; file: File }];
    expect(t[0]).toMatchObject({ model: "gpt-4o-mini-transcribe", language: "es" });
    expect(t[0].file.name).toBe("audio.m4a");
    const c = m.complete.mock.calls[0] as unknown as [any];
    expect(c[0]).toMatchObject({ model: "gpt-4o-mini", temperature: 0 });
    expect(c[0].response_format.type).toBe("json_schema");
    expect(c[0].messages[0].role).toBe("system");
    expect(c[0].messages[1]).toEqual({ role: "user", content: "Cobré el sueldo, un palo doscientos" });
  });

  it("texto: no transcribe", async () => {
    const m = mock();
    const out = await interpretVoice({ text: " cobré " }, ctx, { openai: m.openai });
    expect(out.kind).toBe("draft");
    expect(m.transcribe).not.toHaveBeenCalled();
  });

  it("transcripción vacía → unclear sin llamar al modelo", async () => {
    const m = mock({ text: "  " });
    const out = await interpretVoice({ audio: audio() }, ctx, { openai: m.openai });
    expect(out).toEqual({ kind: "unclear", transcript: "" });
    expect(m.complete).not.toHaveBeenCalled();
  });

  it("sin audio ni texto → bad_audio", async () => {
    await expect(interpretVoice({}, ctx, { openai: mock().openai })).rejects.toMatchObject({ code: "bad_audio", retryable: false });
  });

  it("audio vacío y demasiado grande → bad_audio sin llamar a OpenAI", async () => {
    const m = mock();
    await expect(interpretVoice({ audio: audio(0) }, ctx, { openai: m.openai })).rejects.toMatchObject({ code: "bad_audio" });
    await expect(interpretVoice({ audio: audio(MAX_AUDIO_BYTES + 1) }, ctx, { openai: m.openai })).rejects.toMatchObject({ code: "bad_audio" });
    expect(m.transcribe).not.toHaveBeenCalled();
  });

  it("sin OPENAI_API_KEY → not_configured no reintentable", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await expect(interpretVoice({ text: "hola" }, ctx)).rejects.toMatchObject({ code: "not_configured", retryable: false });
    } finally {
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    }
  });

  it("JSON inválido: reintenta una vez y se recupera", async () => {
    const m = mock({ chat: (n) => (n === 0 ? "{no json" : extraction()) });
    const out = await interpretVoice({ text: "cobré" }, ctx, { openai: m.openai });
    expect(out.kind).toBe("draft");
    expect(m.complete).toHaveBeenCalledTimes(2);
  });

  it("JSON inválido dos veces → interpretation_failed reintentable", async () => {
    const m = mock({ chat: () => "nope" });
    await expect(interpretVoice({ text: "cobré" }, ctx, { openai: m.openai })).rejects.toMatchObject({ code: "interpretation_failed", retryable: true });
    expect(m.complete).toHaveBeenCalledTimes(2);
  });

  it("errores del proveedor en la extracción se propagan clasificados", async () => {
    const m = mock();
    m.complete.mockRejectedValueOnce(httpErr(503));
    await expect(interpretVoice({ text: "cobré" }, ctx, { openai: m.openai })).rejects.toMatchObject({ code: "provider_unavailable", retryable: true });
  });

  it("error 400 del proveedor en la transcripción → bad_audio", async () => {
    const m = mock();
    m.transcribe.mockRejectedValueOnce(httpErr(400));
    await expect(interpretVoice({ audio: audio() }, ctx, { openai: m.openai })).rejects.toMatchObject({ code: "bad_audio", retryable: false });
  });
});

describe("classifyProviderError", () => {
  const cases: [string, unknown, string, boolean][] = [
    ["429", httpErr(429), "provider_unavailable", true],
    ["500", httpErr(500), "provider_unavailable", true],
    ["502", httpErr(502), "provider_unavailable", true],
    ["429 sin cuota", httpErr(429, { code: "insufficient_quota" }), "internal", false],
    ["401", httpErr(401), "not_configured", false],
    ["400 en extract", httpErr(400), "internal", false],
    ["timeout", Object.assign(new Error("t"), { name: "APIConnectionTimeoutError" }), "provider_unavailable", true],
    ["conexión", Object.assign(new Error("c"), { name: "APIConnectionError" }), "provider_unavailable", true],
    ["ECONNRESET", Object.assign(new Error("c"), { code: "ECONNRESET" }), "provider_unavailable", true],
    ["desconocido", new Error("boom"), "internal", false],
  ];
  it.each(cases)("%s", (_n, err, code, retryable) => {
    expect(classifyProviderError(err, "extract")).toMatchObject({ code, retryable });
  });

  it("deja pasar un VoiceError", () => {
    const e = new VoiceError("x", "bad_audio", false);
    expect(classifyProviderError(e, "extract")).toBe(e);
  });
});

describe("registro y respuesta", () => {
  it("solo los no reintentables (salvo bad_audio) se reportan", () => {
    expect(shouldReport(new VoiceError("x", "internal", false))).toBe(true);
    expect(shouldReport(new VoiceError("x", "not_configured", false))).toBe(true);
    expect(shouldReport(new VoiceError("x", "bad_audio", false))).toBe(false);
    expect(shouldReport(new VoiceError("x", "provider_unavailable", true))).toBe(false);
  });

  it("toVoiceApiError arma el cuerpo del contrato", () => {
    expect(toVoiceApiError(new VoiceError("detalle interno", "internal", false), true)).toEqual({
      error: "Error interno", code: "internal", retryable: false, reported: true,
    });
  });
});

describe("decodeAudioJson", () => {
  const b64 = (n: number) => Buffer.alloc(n, 1).toString("base64");
  it("decodifica y fuerza .m4a para audio/mp4", async () => {
    const f = decodeAudioJson({ base64: b64(50), mimeType: "audio/mp4", name: "voz.mp4" });
    expect(f.name).toBe("voz.m4a");
    expect(f.size).toBe(50);
  });
  it("rechaza vacío, sin base64 y demasiado grande con bad_audio", () => {
    for (const raw of [null, {}, { base64: "" }, { base64: b64(MAX_AUDIO_BYTES + 1), mimeType: "audio/mp4" }]) {
      expect(() => decodeAudioJson(raw)).toThrow(expect.objectContaining({ code: "bad_audio" }));
    }
  });
});
