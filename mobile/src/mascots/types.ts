import type { ComponentType } from "react";
import type { ThemeMode } from "../design-system";

export type MascotId = "omero" | "pincho" | "mati" | "zorro";
export type Mood = "calma" | "feliz" | "atento" | "festeja";
/** El modo de la mascota es el modo del tema. */
export type Mode = ThemeMode;

export const MOODS: readonly Mood[] = ["calma", "feliz", "atento", "festeja"];
export const MASCOT_IDS: readonly MascotId[] = ["omero", "pincho", "mati", "zorro"];

/** Momentos con frase propia (claves en `mascots:<id>.lines.<momento>`). */
export type MascotMoment = "dailyRemainder" | "allGood" | "pendingConfirm" | "debtDown" | "comeback";

/** Props de cada dibujo. Dibuja elementos SVG en un viewBox 0 0 200 200 (los envuelve <Mascot/>). */
export interface DrawingProps {
  mood: Mood;
  mode: Mode;
}

export interface MascotDefinition {
  id: MascotId;
  /** Prefijo de claves en el namespace i18n `mascots` (`<i18nKey>.name`, `.species`, `.story.*`, `.lines.*`). */
  i18nKey: MascotId;
  /** Color del círculo de fondo por modo. El anillo sale de `theme.colors.backdropRing`. */
  backdrop: Record<Mode, string>;
  Drawing: ComponentType<DrawingProps>;
  story: { chapters: number };
}
