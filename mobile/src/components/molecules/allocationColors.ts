/** Cantidad de colores de la paleta categórica del DS (`colors.chartCategorical`). */
export const CATEGORICAL_SIZE = 8;

/**
 * Índice estable de color para una categoría: su posición en `orderedIds` (el orden en que la pantalla
 * dibuja los segmentos), módulo el tamaño de la paleta. Si el id no está en la lista, se deriva de un hash
 * del id (siempre el mismo para el mismo id). Así una categoría conserva su color entre Presupuesto y Gastos fijos.
 */
export function categoryColorIndex(categoryId: string, orderedIds: readonly string[], size: number = CATEGORICAL_SIZE): number {
  const n = Math.max(1, Math.floor(size));
  const at = orderedIds.indexOf(categoryId);
  if (at >= 0) return at % n;
  let hash = 0;
  for (let i = 0; i < categoryId.length; i++) hash = (hash * 31 + categoryId.charCodeAt(i)) >>> 0;
  return hash % n;
}

function luminance(hex: string): number | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const full = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste WCAG entre dos colores hex; null si alguno no es `#rgb` / `#rrggbb`. */
export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * De los colores candidatos, el que mejor se lee sobre `background` (para un ícono sobre un color de la paleta
 * categórica, que cambia de claro a oscuro según el tema). Si no se puede calcular, devuelve el primero.
 */
export function readableOn(background: string, candidates: readonly [string, ...string[]]): string {
  let best = candidates[0];
  let bestRatio = -1;
  for (const c of candidates) {
    const r = contrastRatio(background, c);
    if (r !== null && r > bestRatio) {
      best = c;
      bestRatio = r;
    }
  }
  return best;
}
