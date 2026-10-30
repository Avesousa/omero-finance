import { resolveVoiceOutcome, type VoiceContext, type VoiceExtraction, type VoiceOutcome } from "../../domain/index.ts";

/** Texto que el mock "escucha" cuando hay audio (no hay transcripción real). */
export const MOCK_AUDIO_TEXT = "Me pagaron el sueldo, un millón doscientos mil";

const norm = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const UNITS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500,
  seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
};
const MILLION = new Set(["millon", "millones", "palo", "palos"]);
const THOUSAND = new Set(["mil", "luca", "lucas"]);

/** "un millón doscientos mil" → 1200000. Solo acepta tramos con escala (mil/millón/palo) o de 100 para arriba. */
function wordsAmount(text: string): number | null {
  let best: number | null = null;
  let total = 0;
  let current = 0;
  let inRun = false;
  let scaled = false;
  const close = () => {
    const value = total + current;
    if (inRun && value > 0 && (scaled || value >= 100) && (best === null || value > best)) best = value;
    total = 0;
    current = 0;
    inRun = false;
    scaled = false;
  };
  for (const tok of text.replace(/[^a-z0-9\s]/g, " ").split(" ")) {
    if (!tok) continue;
    if (tok in UNITS) {
      current += UNITS[tok];
      inRun = true;
    } else if (MILLION.has(tok)) {
      total += (current || 1) * 1_000_000;
      current = 0;
      inRun = true;
      scaled = true;
    } else if (THOUSAND.has(tok)) {
      total += (current || 1) * 1_000;
      current = 0;
      inRun = true;
      scaled = true;
    } else if (tok === "y" && inRun) {
      continue;
    } else {
      close();
    }
  }
  close();
  return best;
}

/** "$ 45.000", "45 mil", "1,5 millones", "USD 300", "1.200.000,50" → número. Elige el candidato más grande. */
function digitsAmount(text: string): number | null {
  const re = /(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)\s*(millones|millon|palos|palo|mil|lucas|luca|k)?\b/g;
  let best: number | null = null;
  for (const m of text.matchAll(re)) {
    const raw = m[1];
    let n: number;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) n = Number(raw.replace(/\./g, "").replace(",", "."));
    else n = Number(raw.replace(",", "."));
    const unit = m[2];
    if (unit) n *= MILLION.has(unit) ? 1_000_000 : 1_000;
    if (Number.isFinite(n) && n > 0 && (best === null || n > best)) best = n;
  }
  return best;
}

/** Monto dicho en el texto (en dígitos o en palabras), o null. Exportado para tests. */
export function parseSpokenAmount(text: string): number | null {
  const t = norm(text);
  const d = digitsAmount(t);
  const w = wordsAmount(t);
  if (d !== null && w !== null) return Math.max(d, w);
  return d ?? w;
}

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const has = (t: string, re: RegExp) => re.test(t);

/**
 * Intérprete local por palabras clave: hace de modelo en modo mock. Arma la misma `VoiceExtraction`
 * que devolvería la API; después se pasa por `resolveVoiceOutcome` igual que en el servidor.
 */
export function mockInterpret(text: string, ctx: VoiceContext): VoiceExtraction {
  const t = norm(text);
  if (!t) return { intent: "unclear", income: null };

  if (has(t, /\bresumen\b/)) return { intent: "card_statement", income: null };
  if (has(t, /\bcuotas?\b/) && has(t, /\b(tarjeta|visa|master|mastercard|amex)\b/)) {
    return { intent: "card_purchase", income: null };
  }
  if (has(t, /\b(debo|preste|prestamos?|me deben|deuda)\b/)) return { intent: "debt", income: null };

  const isIncome = has(
    t,
    /\b(cobre|cobro|me pagaron|me depositaron|me transfirieron|me transfirio|sueldo|ingreso|ingresos)\b/,
  );
  if (!isIncome) {
    if (has(t, /\b(gaste|pague|compre|gasto)\b/)) return { intent: "expense", income: null };
    if (has(t, /\b(hola|buenas|buen dia|como estas|quien sos|contame|chiste|gracias|que tal)\b/)) {
      return { intent: "chat", income: null };
    }
    return { intent: "unclear", income: null };
  }

  const cat = ctx.incomeCategories.find((c) => {
    const n = norm(c.name);
    return t.includes(n) || t.includes(n.replace(/(es|s)$/, ""));
  });
  const fixed = has(t, /\b(todos los meses|cada mes|mensual|fijo)\b/);
  const date = has(t, /\bayer\b/) ? shiftDay(ctx.today, -1) : has(t, /\banteayer\b/) ? shiftDay(ctx.today, -2) : null;
  const name = cat?.name ?? (has(t, /\bsueldo\b/) ? "Sueldo" : "Ingreso");

  return {
    intent: "income",
    income: {
      name,
      amount: parseSpokenAmount(text),
      currency: has(t, /\b(usd|u\$s|dolar|dolares|verdes)\b/) ? "USD" : "ARS",
      categoryName: cat?.name ?? null,
      date,
      fixed,
      frequency: fixed ? "MONTHLY" : null,
      note: null,
    },
  };
}

/** `mockInterpret` + `resolveVoiceOutcome`: lo que haría el servidor completo. */
export function mockOutcome(text: string, ctx: VoiceContext): VoiceOutcome {
  return resolveVoiceOutcome(text, mockInterpret(text, ctx), ctx);
}
