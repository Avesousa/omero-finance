import { palette } from "./palette";

export type ThemeMode = "tranqui" | "atrevido";
export const THEME_MODES: readonly ThemeMode[] = ["tranqui", "atrevido"];

/** Roles semánticos de color. Los componentes usan solo estos nombres, nunca hex. */
export interface ThemeColors {
  bg: string;
  surface: string;
  border: string;
  ink: string;
  inkMuted: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  positive: string;
  positiveInk: string;
  warning: string;
  onWarning: string;
  danger: string;
  dangerInk: string;
  dangerTint: string;
  /** Ícono/etiqueta de la pestaña activa. */
  tabActive: string;
  overlay: string;
  /** Anillo de 2px alrededor del círculo de cada mascota. */
  backdropRing: string;
  /** Fondo del interruptor Disponible | Libre dentro del héroe. */
  heroTrack: string;
  /** Opción activa del interruptor del héroe y su texto. */
  heroToggle: string;
  onHeroToggle: string;
  /** Contorno de la muestra "Otros" en leyendas de gráficos. */
  chartOutline: string;
  /** Serie de colores para barras/leyendas (5 posiciones; la última es "Otros"). */
  chart: readonly [string, string, string, string, string];
}

export interface ThemeEffects {
  /** `boxShadow` del héroe (solo Atrevido tiene brillo). */
  hero: string | undefined;
  /** `boxShadow` del botón central de la barra. */
  fab: string | undefined;
}

export interface ThemeDefinition {
  colors: ThemeColors;
  effects: ThemeEffects;
  /** Texto de la barra de estado: oscuro sobre fondos claros. */
  statusBar: "dark" | "light";
  /** Atrevido muestra stickers y accesorios; Tranqui no. */
  bold: boolean;
}

const t = palette.tranqui;
const a = palette.atrevido;

const tranqui: ThemeDefinition = {
  statusBar: "dark",
  bold: false,
  effects: { hero: undefined, fab: undefined },
  colors: {
    bg: t.bg,
    surface: t.surface,
    border: t.border,
    ink: t.ink,
    inkMuted: t.inkMuted,
    primary: t.primary,
    onPrimary: palette.white,
    accent: t.accent,
    onAccent: t.ink,
    positive: t.positive,
    positiveInk: t.positiveInk,
    warning: t.warning,
    onWarning: palette.onWarning,
    danger: t.danger,
    dangerInk: t.dangerInk,
    dangerTint: t.dangerTint,
    tabActive: t.primary,
    overlay: t.overlay,
    backdropRing: t.border,
    heroTrack: t.heroTrack,
    heroToggle: palette.white,
    onHeroToggle: t.ink,
    chartOutline: t.chartOutline,
    chart: [t.primary, t.accent, t.positive, t.warning, t.border],
  },
};

const atrevido: ThemeDefinition = {
  statusBar: "light",
  bold: true,
  effects: { hero: `0 0 28px ${a.glowHero}`, fab: `0 0 18px ${a.glowFab}` },
  colors: {
    bg: a.bg,
    surface: a.surface,
    border: a.border,
    ink: a.ink,
    inkMuted: a.inkMuted,
    primary: a.primary,
    onPrimary: palette.white,
    accent: a.accent,
    onAccent: a.onAccent,
    positive: a.positive,
    positiveInk: a.positive,
    warning: a.warning,
    onWarning: palette.onWarning,
    danger: a.danger,
    dangerInk: a.dangerInk,
    dangerTint: a.dangerTint,
    tabActive: a.accent,
    overlay: a.overlay,
    backdropRing: a.accent,
    heroTrack: a.heroTrack,
    heroToggle: a.accent,
    onHeroToggle: a.onAccent,
    chartOutline: a.chartOutline,
    chart: [a.primary, a.accent, a.positive, a.warning, a.border],
  },
};

export const themes: Record<ThemeMode, ThemeDefinition> = { tranqui, atrevido };
