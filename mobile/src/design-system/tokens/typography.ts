import type { TextStyle } from "react-native";

/**
 * Nombres de familia tal como los registra `useAppFonts` (un archivo por peso: React Native
 * no sintetiza pesos de forma confiable con fuentes propias, así que no se usa fontWeight).
 */
export const fontFamily = {
  display700: "Unbounded_700Bold",
  display800: "Unbounded_800ExtraBold",
  display900: "Unbounded_900Black",
  sans500: "Manrope_500Medium",
  sans600: "Manrope_600SemiBold",
  sans700: "Manrope_700Bold",
  sans800: "Manrope_800ExtraBold",
} as const;

type Style = Pick<TextStyle, "fontFamily" | "fontSize" | "lineHeight" | "letterSpacing">;

const em = (size: number, value: number) => Math.round(size * value * 100) / 100;

/** Estilos tipográficos del DS (display = Unbounded, el resto = Manrope). */
export const typography = {
  /** Monto de héroe: tamaño fijo pensado para `$ 100.000.000` (+ decimales en `heroAmountDecimals`). */
  heroAmount: { fontFamily: fontFamily.display900, fontSize: 30, lineHeight: 36, letterSpacing: em(30, -0.02) },
  /** Decimales del monto de héroe (`,00`), alineados por la base con `heroAmount`. */
  heroAmountDecimals: { fontFamily: fontFamily.display800, fontSize: 17, lineHeight: 22 },
  screenTitle: { fontFamily: fontFamily.display800, fontSize: 24, lineHeight: 30, letterSpacing: em(24, -0.02) },
  cardTitle: { fontFamily: fontFamily.display700, fontSize: 15, lineHeight: 20, letterSpacing: em(15, -0.02) },
  number: { fontFamily: fontFamily.display800, fontSize: 18, lineHeight: 24, letterSpacing: em(18, -0.02) },
  /** Número chico de tarjeta (ej. "3 de 7"): Unbounded 700 15px. */
  numberSmall: { fontFamily: fontFamily.display700, fontSize: 15, lineHeight: 20, letterSpacing: em(15, -0.02) },
  body: { fontFamily: fontFamily.sans500, fontSize: 15, lineHeight: 22 },
  bodySemi: { fontFamily: fontFamily.sans600, fontSize: 15, lineHeight: 20 },
  bodyStrong: { fontFamily: fontFamily.sans700, fontSize: 15, lineHeight: 22 },
  secondary: { fontFamily: fontFamily.sans500, fontSize: 13, lineHeight: 18 },
  secondarySemi: { fontFamily: fontFamily.sans600, fontSize: 13, lineHeight: 18 },
  secondaryStrong: { fontFamily: fontFamily.sans800, fontSize: 13, lineHeight: 18 },
  /** Rótulos: escribir el texto ya en mayúsculas. */
  label: { fontFamily: fontFamily.sans800, fontSize: 11, lineHeight: 14, letterSpacing: em(11, 0.08) },
  tab: { fontFamily: fontFamily.sans600, fontSize: 11, lineHeight: 14 },
  tabActive: { fontFamily: fontFamily.sans800, fontSize: 11, lineHeight: 14 },
  sticker: { fontFamily: fontFamily.display900, fontSize: 11, lineHeight: 14, letterSpacing: em(11, 0.04) },
} as const satisfies Record<string, Style>;

export type TypeVariant = keyof typeof typography;
