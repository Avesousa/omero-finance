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
