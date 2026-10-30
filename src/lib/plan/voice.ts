/**
 * Carga por voz (o texto libre) — contrato compartido entre la web (API) y la app.
 * Lógica pura: sin DB, sin red, sin React. La app lo importa vía `mobile/src/domain`.
 *
 * Flujo: audio → transcripción → el modelo devuelve `VoiceExtraction` (JSON con esquema estricto)
 * → `resolveVoiceOutcome` lo valida contra lo que la app sabe cargar y contra los datos del hogar
 * → `VoiceOutcome`, que la app muestra: un borrador para confirmar o una respuesta de la mascota.
 * Nunca se guarda nada directo: el usuario siempre confirma el formulario.
 */

export type VoiceIntent =
  | "income"         // ingreso: sueldo, cobro, transferencia recibida
  | "expense"        // gasto
  | "debt"           // préstamo o deuda (debo / me deben)
  | "card_purchase"  // compra con tarjeta (en cuotas)
  | "card_statement" // resumen de tarjeta
  | "chat"           // le habla a la mascota, saluda, pregunta otra cosa
  | "unclear";       // no se entiende, está vacío o se va por las ramas

/** Lo que la app ya sabe cargar por voz. Sumar acá cuando se habilite otro tipo. */
export const VOICE_SUPPORTED = ["income"] as const satisfies readonly VoiceIntent[];
export type VoiceSupportedIntent = (typeof VOICE_SUPPORTED)[number];

/** Acciones reales que todavía no se cargan por voz (la mascota pide que esperes). */
export type VoicePendingIntent = Exclude<VoiceIntent, VoiceSupportedIntent | "chat" | "unclear">;

export type VoiceFrequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

/** Borrador de ingreso. Todo lo que no se dijo queda en null y lo completa el formulario. */
export interface IncomeDraft {
  name: string | null;
  amount: number | null;
  currency: "ARS" | "USD";
  /** Id de una categoría de ingreso del hogar, solo si coincide con lo dicho. */
  categoryId: string | null;
  /** 'YYYY-MM-DD' si se dijo una fecha ("ayer", "el 5"); si no, null (= hoy). */
  date: string | null;
  /** Si dijo que es fijo / todos los meses. */
  fixed: { frequency: VoiceFrequency } | null;
  note: string | null;
}

export type VoiceOutcome =
  | { kind: "draft"; intent: "income"; transcript: string; draft: IncomeDraft }
  | { kind: "notYet"; intent: VoicePendingIntent; transcript: string }
  | { kind: "chat"; transcript: string }
  | { kind: "unclear"; transcript: string };

/** Datos del hogar que se le pasan al modelo para que no invente nombres. */
export interface VoiceContext {
  today: string; // 'YYYY-MM-DD'
  incomeCategories: { id: string; name: string }[];
}

/** Respuesta cruda del modelo (debe cumplir `VOICE_EXTRACTION_SCHEMA`). */
export interface VoiceExtraction {
  intent: VoiceIntent;
  income: {
    name: string | null;
    amount: number | null;
    currency: "ARS" | "USD" | null;
    categoryName: string | null;
    date: string | null;
    fixed: boolean;
    frequency: VoiceFrequency | null;
    note: string | null;
  } | null;
}

/** JSON Schema estricto para salidas estructuradas (OpenAI `response_format: json_schema`). */
export const VOICE_EXTRACTION_SCHEMA = {
  name: "voice_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["intent", "income"],
    properties: {
      intent: {
        type: "string",
        enum: ["income", "expense", "debt", "card_purchase", "card_statement", "chat", "unclear"],
      },
      income: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            required: ["name", "amount", "currency", "categoryName", "date", "fixed", "frequency", "note"],
            properties: {
              name: { type: ["string", "null"] },
              amount: { type: ["number", "null"] },
              currency: { type: ["string", "null"], enum: ["ARS", "USD", null] },
              categoryName: { type: ["string", "null"] },
              date: { type: ["string", "null"] },
              fixed: { type: "boolean" },
              frequency: { type: ["string", "null"], enum: ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", null] },
              note: { type: ["string", "null"] },
            },
          },
        ],
      },
    },
  },
} as const;

/** Instrucciones para el modelo que interpreta el texto. */
export function voiceSystemPrompt(ctx: VoiceContext): string {
  const cats = ctx.incomeCategories.map((c) => c.name).join(", ") || "(ninguna)";
  return [
    "Interpretás lo que una persona de Argentina dice para cargar sus finanzas personales en una app.",
    `Hoy es ${ctx.today}. Montos en pesos argentinos salvo que diga dólares/USD/verdes.`,
    "Clasificá la intención en una sola de: income (cobró o recibió plata), expense (gastó o pagó algo),",
    "debt (préstamo o deuda, que debe o que le deben), card_purchase (compra con tarjeta en cuotas),",
    "card_statement (resumen de tarjeta), chat (saluda, le habla a la mascota, pregunta algo que no es cargar),",
    "unclear (vacío, sin sentido, o no se puede saber qué quiere cargar).",
    "Solo si es income completá `income`; si no, `income` es null.",
    'Montos: "45 mil" = 45000, "1 palo" o "un millón" = 1000000, "1,5 M" = 1500000, "lucas" = miles.',
    `Categorías de ingreso del hogar (usá el nombre exacto si coincide, si no null): ${cats}.`,
    'Fechas relativas ("ayer", "el viernes", "el 5") → YYYY-MM-DD; si no dice, null.',
    '"todos los meses", "fijo", "sueldo mensual" → fixed true con frequency MONTHLY.',
    "No inventes datos que no se dijeron: dejalos en null.",
  ].join("\n");
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/**
 * Valida la extracción del modelo y la convierte en lo que la app muestra.
 * - Intenciones soportadas → borrador (con la categoría resuelta a un id real, o null).
 * - Otras acciones de finanzas → `notYet`.
 * - Transcripción vacía → `unclear`.
 */
export function resolveVoiceOutcome(
  transcript: string,
  extraction: VoiceExtraction | null,
  ctx: VoiceContext,
): VoiceOutcome {
  const text = transcript.trim();
  if (!text || !extraction) return { kind: "unclear", transcript: text };
  const intent = extraction.intent;
  if (intent === "chat") return { kind: "chat", transcript: text };
  if (intent === "unclear") return { kind: "unclear", transcript: text };
  if (intent === "income") {
    const raw = extraction.income;
    if (!raw) return { kind: "unclear", transcript: text };
    const cat = raw.categoryName
      ? ctx.incomeCategories.find((c) => norm(c.name) === norm(raw.categoryName!))
      : undefined;
    const amount = raw.amount != null && Number.isFinite(raw.amount) && raw.amount > 0
      ? Math.round(raw.amount * 100) / 100
      : null;
    return {
      kind: "draft",
      intent: "income",
      transcript: text,
      draft: {
        name: raw.name?.trim() || null,
        amount,
        currency: raw.currency === "USD" ? "USD" : "ARS",
        categoryId: cat?.id ?? null,
        date: raw.date && ISO_DATE.test(raw.date) ? raw.date : null,
        fixed: raw.fixed ? { frequency: raw.frequency ?? "MONTHLY" } : null,
        note: raw.note?.trim() || null,
      },
    };
  }
  return { kind: "notYet", intent, transcript: text };
}

/** Error de la carga por voz tal como lo devuelve la API: `{ error, code, retryable, reported }`. */
export interface VoiceApiError {
  error: string;
  code: "transcription_failed" | "interpretation_failed" | "provider_unavailable" | "not_configured" | "bad_audio" | "internal";
  /** true = vale la pena reintentar (red, 429, 5xx del proveedor). */
  retryable: boolean;
  /** true = ya quedó registrado para el admin. */
  reported: boolean;
}
