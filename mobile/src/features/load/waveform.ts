/** Forma de onda de una grabación: puro, sin dependencias (lo usan el grabador y los tests). */

export const WAVEFORM_BARS = 32;

/** dB del micrófono (-60 silencio … 0 fuerte) → 0..1. */
export function meterToLevel(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.min(1, Math.max(0, (db + 60) / 60));
}

/** Onda pareja y suave para cuando no hay medición (web, sin metering). Determinística. */
export function flatWaveform(bars: number = WAVEFORM_BARS): number[] {
  return Array.from({ length: bars }, (_, i) => Math.round((0.45 + 0.2 * Math.sin(i * 0.7) + 0.08 * Math.sin(i * 1.9)) * 1000) / 1000);
}

/**
 * Reduce muestras de nivel (0..1, ~una cada 100 ms) a `bars` barras 0..1: promedia cada tramo y escala para que la más alta sea 1
 * (piso 0.08 para que ninguna barra desaparezca). Con muy pocas muestras devuelve la onda pareja.
 */
export function buildWaveform(samples: readonly number[], bars: number = WAVEFORM_BARS): number[] {
  const clean = samples.filter((s) => Number.isFinite(s)).map((s) => Math.min(1, Math.max(0, s)));
  if (clean.length < 4) return flatWaveform(bars);
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const from = Math.floor((i * clean.length) / bars);
    const to = Math.max(from + 1, Math.floor(((i + 1) * clean.length) / bars));
    const slice = clean.slice(from, Math.min(to, clean.length));
    out.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  const peak = Math.max(...out);
  if (peak <= 0.001) return flatWaveform(bars);
  return out.map((v) => Math.round(Math.max(0.08, v / peak) * 1000) / 1000);
}
