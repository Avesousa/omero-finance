import type { ThemeDefinition } from "./themes";

/**
 * Colores de finanza. Los hex se COPIAN de `FINANCE_PALETTE` en src/lib/plan/finances.ts
 * (mobile no importa de src/lib). Un test compara ambos: si cambia uno, hay que cambiar el otro.
 */
export const FINANCE_PALETTE = {
  violeta:  { light: "#6A43B8", dark: "#B79CF0" },
  azul:     { light: "#1F5FBF", dark: "#7FB0F5" },
  naranja:  { light: "#B45309", dark: "#F0B84A" },
  rosa:     { light: "#B83280", dark: "#F29BCB" },
  turquesa: { light: "#0E7C86", dark: "#6FD3DB" },
  rojo:     { light: "#A3352B", dark: "#F08A7E" },
} as const;

export type FinancePaletteKey = keyof typeof FINANCE_PALETTE;

export const DEFAULT_SHARED_COLOR: FinancePaletteKey = "violeta";

export function isFinancePaletteKey(v: unknown): v is FinancePaletteKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(FINANCE_PALETTE, v);
}

/**
 * Color de una finanza para el tema actual. `null` = la finanza usa el color de Omero (PERSONAL, o clave desconocida).
 * `statusBar` "dark" = fondo claro → hex `light`; "light" = fondo oscuro → hex `dark`.
 */
export function financeAccent(color: string | null | undefined, statusBar: "dark" | "light"): string | null {
  if (!isFinancePaletteKey(color)) return null;
  return FINANCE_PALETTE[color][statusBar === "dark" ? "light" : "dark"];
}

/** Hex con transparencia (para la cápsula de la pestaña activa). `alpha` de 0 a 1. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, "0");
  return `${hex}${a}`;
}

/** Mezcla dos hex `#RRGGBB`: `t` = 0 devuelve `a`, 1 devuelve `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const k = Math.min(Math.max(t, 0), 1);
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) * (1 - k) + ch(b, i) * k).toString(16).padStart(2, "0"));
  return `#${out.join("")}`;
}

/**
 * Pinta un tema con el color de una finanza: el color elegido manda en la navegación, el botón Cargar,
 * los gráficos y el degradé del héroe, tanto en Tranqui como en Atrevido. Pura: no muta `def`.
 */
export function tintTheme(def: ThemeDefinition, accent: string): ThemeDefinition {
  const { colors, bold } = def;
  const heroColors: readonly [string, string, string] = bold
    ? [mixHex(accent, "#000000", 0.35), mixHex(colors.bg, accent, 0.28), colors.bg]
    : [mixHex(accent, "#FFFFFF", 0.52), mixHex(accent, "#FFFFFF", 0.77), colors.bg];
  return {
    ...def,
    gradients: { hero: { colors: heroColors, locations: def.gradients.hero.locations } },
    effects: {
      ...def.effects,
      hero: def.effects.hero ? `0 0 28px ${withAlpha(accent, 0.55)}` : undefined,
      fab: def.effects.fab ? `0 0 18px ${withAlpha(accent, 0.7)}` : undefined,
    },
    colors: {
      ...colors,
      primary: accent,
      // En Atrevido el "acento" de Omero (cian) es la marca: lo reemplaza el color de la finanza.
      accent: bold ? accent : colors.accent,
      tabActive: accent,
      tabActiveBg: withAlpha(accent, 0.16),
      fab: accent,
      backdropRing: bold ? accent : colors.backdropRing,
      heroTrack: mixHex(accent, "#000000", bold ? 0.45 : 0.28),
      heroToggle: bold ? accent : colors.heroToggle,
      chartHighlight: accent,
      chart: [accent, ...colors.chart.slice(1)] as unknown as typeof colors.chart,
    },
  };
}
