/**
 * Prueba de la voz con OpenAI de verdad, sin app ni base de datos.
 *
 *   npx tsx scripts/voice-try.ts "cobré 45 mil de sueldo"
 *   npx tsx scripts/voice-try.ts --audio ruta.m4a
 *   npx tsx scripts/voice-try.ts --batch
 *   npx tsx scripts/voice-try.ts "..." --categories "Sueldo,Changas"
 *
 * Necesita OPENAI_API_KEY en .env.local o .env. Nunca imprime la clave.
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import {
  VoiceError, interpretVoice, toVoiceApiError,
  type OpenAILike,
} from "../src/lib/plan/voice-server";
import type { VoiceContext, VoiceExtraction, VoiceOutcome } from "../src/lib/plan/voice";

// Igual que prisma.config.ts: .env.local manda, .env completa.
config({ path: ".env.local", override: true, quiet: true });
config({ quiet: true });

const DEFAULT_CATEGORIES = ["Sueldo", "Freelance", "Alquileres", "Otros ingresos"];

const BATCH: string[] = [
  "cobré 45 mil de sueldo",                              // ingreso simple
  "me entró un palo y medio de freelance",               // "un palo y medio"
  "me pagaron 300 dólares de un trabajo freelance",      // en dólares
  "cobro el alquiler del depto, 400 mil todos los meses", // fijo mensual
  "ayer me transfirieron 80 lucas",                      // "ayer"
  "gasté 12 mil en el supermercado",                     // gasto
  "le presté 200 mil a Juan",                            // deuda
  "me compré zapatillas con la Visa en 6 cuotas de 25 mil", // compra en cuotas
  "el resumen de la Visa vino de 412 mil",               // resumen
  "hola, ¿cómo andás?",                                  // saludo / chat
  "contame un chiste",                                   // chiste
  "asdf qwer zxcv ñandú banana",                         // ruido sin sentido
  "   ",                                                 // vacío
];

interface Args { text?: string; audio?: string; batch: boolean; categories: string[] }

function parseArgs(argv: string[]): Args {
  const a: Args = { batch: false, categories: DEFAULT_CATEGORIES };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--batch") a.batch = true;
    else if (v === "--audio") a.audio = argv[++i];
    else if (v === "--categories") a.categories = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (v === "--help" || v === "-h") usage(0);
    else rest.push(v);
  }
  if (rest.length) a.text = rest.join(" ");
  if (!a.batch && !a.text && !a.audio) usage(1);
  return a;
}

function usage(code: number): never {
  console.log('Uso:\n  npx tsx scripts/voice-try.ts "<texto>" [--categories "A,B,C"]\n  npx tsx scripts/voice-try.ts --audio ruta.m4a\n  npx tsx scripts/voice-try.ts --batch');
  process.exit(code);
}

function todayBuenosAires(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

const MIME: Record<string, string> = {
  ".m4a": "audio/m4a", ".mp4": "audio/mp4", ".aac": "audio/aac", ".mp3": "audio/mpeg",
  ".wav": "audio/wav", ".webm": "audio/webm", ".ogg": "audio/ogg", ".flac": "audio/flac",
};

interface Timings { transcribeMs: number | null; extractMs: number | null; totalMs: number }

/** Cliente real de OpenAI que mide cada etapa. Sin clave devuelve undefined (interpretVoice da `not_configured`). */
async function timedClient(t: Timings): Promise<OpenAILike | undefined> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return undefined;
  const { default: OpenAI } = await import("openai");
  const real = new OpenAI({ apiKey, timeout: 25_000, maxRetries: 0 }) as unknown as OpenAILike;
  const timed = async <T,>(key: "transcribeMs" | "extractMs", fn: () => Promise<T>): Promise<T> => {
    const t0 = performance.now();
    try { return await fn(); }
    finally { t[key] = (t[key] ?? 0) + Math.round(performance.now() - t0); }
  };
  return {
    audio: { transcriptions: { create: (p: any) => timed("transcribeMs", () => real.audio.transcriptions.create(p)) } },
    chat: { completions: { create: (p: any) => timed("extractMs", () => real.chat.completions.create(p)) } },
  };
}

interface RunResult {
  outcome?: VoiceOutcome;
  extraction?: VoiceExtraction;
  error?: { message: string; code: string; retryable: boolean; detail: string };
  timings: Timings;
}

async function run(input: { text?: string; audio?: Blob }, ctx: VoiceContext): Promise<RunResult> {
  const timings: Timings = { transcribeMs: null, extractMs: null, totalMs: 0 };
  const res: RunResult = { timings };
  const t0 = performance.now();
  try {
    const openai = await timedClient(timings);
    res.outcome = await interpretVoice(input, ctx, { openai, onExtraction: (raw) => { res.extraction = raw; } });
  } catch (e) {
    const err = e instanceof VoiceError ? e : new VoiceError(String((e as Error)?.message ?? e), "internal", false);
    res.error = { message: toVoiceApiError(err, false).error, code: err.code, retryable: err.retryable, detail: err.message };
  }
  timings.totalMs = Math.round(performance.now() - t0);
  return res;
}

const ms = (n: number | null) => (n == null ? "-" : `${n} ms`);

function printSingle(r: RunResult, input: { text?: string; audio?: string }) {
  console.log(`Entrada:        ${input.audio ? `audio ${input.audio}` : JSON.stringify(input.text)}`);
  if (r.outcome) console.log(`Transcripción:  ${JSON.stringify(r.outcome.transcript)}`);
  console.log("Extracción cruda del modelo:");
  console.log(r.extraction ? indent(JSON.stringify(r.extraction, null, 2)) : "  (no hubo)");
  console.log("VoiceOutcome:");
  console.log(r.outcome ? indent(JSON.stringify(r.outcome, null, 2)) : "  (no hubo)");
  console.log(`Tiempos:        transcripción ${ms(r.timings.transcribeMs)} | interpretación ${ms(r.timings.extractMs)} | total ${ms(r.timings.totalMs)}`);
  if (r.error) {
    console.log(`ERROR:          ${r.error.message}`);
    console.log(`  code=${r.error.code} retryable=${r.error.retryable}`);
    console.log(`  detalle: ${redact(r.error.detail)}`);
  }
}

const indent = (s: string) => s.split("\n").map((l) => `  ${l}`).join("\n");

/** Por las dudas: si un mensaje de error trae algo parecido a una clave, se tapa. */
function redact(s: string): string {
  let out = s.replace(/sk-[A-Za-z0-9_\-*]{6,}/g, "sk-***");
  const key = process.env.OPENAI_API_KEY;
  if (key) out = out.split(key).join("***");
  return out;
}

function row(phrase: string, r: RunResult, ctx: VoiceContext): string[] {
  if (r.error) return [phrase, `ERROR ${r.error.code}${r.error.retryable ? " (retryable)" : ""}`, "-", "-", String(r.timings.totalMs)];
  const o = r.outcome!;
  if (o.kind === "draft") {
    const cat = ctx.incomeCategories.find((c) => c.id === o.draft.categoryId)?.name ?? "-";
    const amount = o.draft.amount == null ? "-" : `${o.draft.amount} ${o.draft.currency}`;
    return [phrase, `${o.intent}${o.draft.fixed ? " (fijo)" : ""}`, amount, cat, String(r.timings.totalMs)];
  }
  const intent = o.kind === "notYet" ? `${o.intent} (notYet)` : o.kind;
  return [phrase, intent, "-", "-", String(r.timings.totalMs)];
}

function printTable(head: string[], rows: string[][]) {
  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const cells = [head, ...rows.map((r) => r.map((c, i) => (i === 0 ? clip(c.trim() || "(vacío)", 46) : c)))];
  const w = head.map((_, i) => Math.max(...cells.map((r) => r[i].length)));
  const line = (r: string[]) => r.map((c, i) => (i === 4 ? c.padStart(w[i]) : c.padEnd(w[i]))).join("  ");
  console.log(line(cells[0]));
  console.log(w.map((n) => "-".repeat(n)).join("  "));
  cells.slice(1).forEach((r) => console.log(line(r)));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const names = args.categories.length ? args.categories : DEFAULT_CATEGORIES;
  const ctx: VoiceContext = {
    today: todayBuenosAires(),
    incomeCategories: names.map((name) => ({
      id: `cat-${name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
      name,
    })),
  };
  console.log(`Hoy (Buenos Aires): ${ctx.today} | categorías: ${ctx.incomeCategories.map((c) => `${c.name} [${c.id}]`).join(", ")}`);
  console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "configurada" : "NO configurada"}\n`);

  if (args.batch) {
    const rows: string[][] = [];
    for (const phrase of BATCH) {
      const r = await run({ text: phrase }, ctx);
      rows.push(row(phrase, r, ctx));
      if (r.error?.code === "not_configured") {
        console.log(`Se corta el lote: ${r.error.message} (code=not_configured, retryable=false).`);
        console.log(`  detalle: ${redact(r.error.detail)}\n`);
        break;
      }
    }
    printTable(["Frase", "Intent", "Monto", "Categoría", "ms"], rows);
    process.exit(rows.some((r) => r[1].startsWith("ERROR")) ? 1 : 0);
  }

  if (args.audio) {
    let buf: Buffer;
    try { buf = readFileSync(args.audio); } catch { console.error(`No pude leer el archivo: ${args.audio}`); process.exit(2); }
    const type = MIME[extname(args.audio).toLowerCase()] ?? "audio/m4a";
    const file = new File([new Uint8Array(buf)], basename(args.audio), { type });
    const r = await run({ audio: file }, ctx);
    printSingle(r, { audio: args.audio });
    process.exit(r.error ? 1 : 0);
  }

  const r = await run({ text: args.text }, ctx);
  printSingle(r, { text: args.text });
  process.exit(r.error ? 1 : 0);
}

main().catch((e) => {
  console.error(redact(String((e as Error)?.message ?? e)));
  process.exit(1);
});
