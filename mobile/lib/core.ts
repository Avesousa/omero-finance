// Lógica pura compartida con la web: no se copia, se importa del mismo archivo.
// Metro lo resuelve gracias a `watchFolders` en metro.config.js.
import * as base from "../../src/lib/plan/core";

export * from "../../src/lib/plan/core";

// ── Resguardo por si el motor de JS del teléfono no trae Intl completo ──
// (los export locales pisan a los de `export *`). La web no pasa por acá.

const BA_OFFSET_MS = -3 * 60 * 60 * 1000; // Buenos Aires no tiene horario de verano

function baParts(now: Date): { y: string; m: string; d: string } {
  const iso = new Date(now.getTime() + BA_OFFSET_MS).toISOString();
  return { y: iso.slice(0, 4), m: iso.slice(5, 7), d: iso.slice(8, 10) };
}

export function currentPeriod(now: Date = new Date()): string {
  try {
    return base.currentPeriod(now);
  } catch {
    const { y, m } = baParts(now);
    return `${y}-${m}`;
  }
}

export function todayIso(now: Date = new Date()): string {
  try {
    return base.todayIso(now);
  } catch {
    const { y, m, d } = baParts(now);
    return `${y}-${m}-${d}`;
  }
}

export function fmtArs(n: number): string {
  try {
    return base.fmtArs(n);
  } catch {
    const r = Math.round(n);
    const s = String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${r < 0 ? "-" : ""}$ ${s}`;
  }
}
