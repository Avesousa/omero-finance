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
  /** Cápsula de fondo de la pestaña activa. */
  tabActiveBg: string;
  /** Botón circular Cargar y su ícono. */
  fab: string;
  onFab: string;
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
  /** Barras de gráficos de barras (tenues). */
  chartBar: string;
  /** Barra resaltada de un gráfico de barras (la actual). */
  chartHighlight: string;
  /** Serie de colores para barras/leyendas (5 posiciones; la última es "Otros"). */
  chart: readonly [string, string, string, string, string];
  /** Paleta categórica de 8 colores (AllocationBar y leyendas por categoría); se indexa con `categoryColorIndex`. */
  chartCategorical: readonly [string, string, string, string, string, string, string, string];
  /** "Sin asignar" en barras apiladas (gris, nunca un color de categoría). */
  chartUnassigned: string;
  /** "Otras" en barras apiladas: gris medio, distinto de `chartUnassigned`. */
  chartOther: string;
  /** Texto principal sobre el degradé del héroe de Inicio. */
  heroInk: string;
  /** Texto secundario sobre el degradé del héroe (contraste AA). */
  heroInkMuted: string;
  /** Cápsula translúcida sobre el degradé del héroe. */
  heroChip: string;
  /** Fondo suave del círculo de la flecha de ingresos. */
  positiveTint: string;
}

export interface ThemeGradients {
  /** Degradé vertical del héroe de Inicio: de color a `bg` (el último color es `bg`, así se funde sin corte). */
  hero: { colors: readonly [string, string, string]; locations: readonly [number, number, number] };
}

export interface ThemeEffects {
  /** `boxShadow` del héroe (solo Atrevido tiene brillo). */
  hero: string | undefined;
  /** `boxShadow` del botón Cargar (brillo en Atrevido). */
  fab: string | undefined;
  /** `boxShadow` de elementos flotantes (píldora de navegación). */
  floating: string;
}

export interface ThemeDefinition {
  colors: ThemeColors;
  gradients: ThemeGradients;
  effects: ThemeEffects;
  /** Texto de la barra de estado: oscuro sobre fondos claros. */
  statusBar: "dark" | "light";
  /** Atrevido muestra stickers y accesorios; Tranqui no. */
  bold: boolean;
}

const t = palette.tranqui;
const a = palette.atrevido;

const HERO_LOCATIONS = [0, 0.55, 1] as const;

const tranqui: ThemeDefinition = {
  statusBar: "dark",
  bold: false,
  effects: { hero: undefined, fab: undefined, floating: `0 6px 20px ${t.shadow}` },
  gradients: { hero: { colors: t.heroGradient, locations: HERO_LOCATIONS } },
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
    tabActiveBg: t.tabActiveBg,
    fab: t.primary,
    onFab: palette.white,
    overlay: t.overlay,
    backdropRing: t.border,
    heroTrack: t.heroTrack,
    heroToggle: palette.white,
    onHeroToggle: t.ink,
    chartOutline: t.chartOutline,
    chartBar: t.chartBar,
    chartHighlight: t.primary,
    chart: [t.primary, t.accent, t.positive, t.warning, t.border],
    chartCategorical: t.categorical,
    chartUnassigned: t.unassigned,
    chartOther: t.other,
    heroInk: t.heroInk,
    heroInkMuted: t.heroInkMuted,
    heroChip: t.heroChip,
    positiveTint: t.positiveTint,
  },
};

const atrevido: ThemeDefinition = {
  statusBar: "light",
  bold: true,
  gradients: { hero: { colors: a.heroGradient, locations: HERO_LOCATIONS } },
  effects: { hero: `0 0 28px ${a.glowHero}`, fab: `0 0 18px ${a.glowFab}`, floating: `0 6px 20px ${a.shadow}` },
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
    tabActiveBg: a.tabActiveBg,
    fab: a.accent,
    onFab: a.onAccent,
    overlay: a.overlay,
    backdropRing: a.accent,
    heroTrack: a.heroTrack,
    heroToggle: a.accent,
    onHeroToggle: a.onAccent,
    chartOutline: a.chartOutline,
    chartBar: a.chartBar,
    chartHighlight: a.accent,
    chart: [a.primary, a.accent, a.positive, a.warning, a.border],
    chartCategorical: a.categorical,
    chartUnassigned: a.unassigned,
    chartOther: a.other,
    heroInk: a.heroInk,
    heroInkMuted: a.heroInkMuted,
    heroChip: a.heroChip,
    positiveTint: a.positiveTint,
  },
};

export const themes: Record<ThemeMode, ThemeDefinition> = { tranqui, atrevido };
