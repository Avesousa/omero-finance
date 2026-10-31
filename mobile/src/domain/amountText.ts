/**
 * Parser de montos escritos o dichos en español rioplatense. Puro (sin imports): lo usan la voz
 * en modo mock y el asistente de presupuesto ("300 mil", "1,5 palos", "un millón doscientos mil").
 */

/** Minúsculas, sin acentos y con espacios colapsados. */
export function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

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

/** Monto dicho o escrito en el texto (en dígitos o en palabras), o null. */
export function parseSpokenAmount(text: string): number | null {
  const t = normalizeText(text);
  const d = digitsAmount(t);
  const w = wordsAmount(t);
  if (d !== null && w !== null) return Math.max(d, w);
  return d ?? w;
}
