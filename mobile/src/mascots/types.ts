import type { ComponentType } from "react";
import type { ThemeMode } from "../design-system";

export type MascotId = "omero" | "pincho" | "mati" | "zorro";
export type Mood = "calma" | "feliz" | "atento" | "festeja";
/** El modo de la mascota es el modo del tema. */
export type Mode = ThemeMode;

export const MOODS: readonly Mood[] = ["calma", "feliz", "atento", "festeja"];
export const MASCOT_IDS: readonly MascotId[] = ["omero", "pincho", "mati", "zorro"];

/** Momentos con frase propia (claves en `mascots:<id>.lines.<momento>`). */
export type MascotMoment =
  | "dailyRemainder"
  | "allGood"
  | "pendingConfirm"
  | "debtDown"
  | "comeback"
  | "cards"
  | "cardsDue" | "cardsOverdue"
  | "cardsAllPaid"
  | "wealth"
  | "wealthUp"
  | "wealthDown"
  | "debts"
  | "debtsDueSoon"
  | "debtsAllPaid"
  | "owedPending"
  | "owedAllCollected"
  | "voiceIdle"
  | "voiceListening"
  | "voiceThinking"
  | "voiceUnclear"
  | "voiceChat"
  | "voiceNotYet"
  | "voiceErrorRetry"
  | "monthNotStarted"
  | "voiceErrorReported"
  | "voicePermission"
  | "voiceDraftReady"
  | "voiceDraftIncomplete"
  | "incomeSaved"
  | "expenseSaved"
  | "debtSaved"
  | "loadGreeting"
  | "draftDismissed"
  | "budgetUnassigned"
  | "budgetBalanced"
  | "budgetOver"
  | "budgetAssistIntro"
  | "budgetAssistSavings"
  | "budgetAssistSavingsNew"
  | "budgetAssistCategory"
  | "budgetAssistCategoryNew"
  | "budgetAssistAskAmount"
  | "budgetAssistMore"
  | "fixedAllPaid"
  | "fixedPending"
  | "fixedNextDue"
  | "fixedSaved"
  | "fixedStopped"
  | "budgetAssistDone"
  | "budgetNear"
  | "budgetOverCategory"
  | "budgetSaveError";

/** Props de cada dibujo. Dibuja elementos SVG en un viewBox 0 0 200 200 (los envuelve <Mascot/>). */
export interface DrawingProps {
  mood: Mood;
  mode: Mode;
}

/** Capítulo de la historia = etapa del nido. */
export type NestChapter = 1 | 2 | 3;

/** Props de una escena del nido: se dibuja a `size` px de ancho (viewBox 320x200) y trae su propio <Svg>. */
export interface NestProps {
  chapter: NestChapter;
  /** Avance dentro del capítulo, 0..1. */
  progress: number;
  mode: Mode;
  /** Ancho en px; el alto es size * 200 / 320. */
  size: number;
}

export interface MascotDefinition {
  id: MascotId;
  /** Prefijo de claves en el namespace i18n `mascots` (`<i18nKey>.name`, `.species`, `.story.*`, `.lines.*`). */
  i18nKey: MascotId;
  /** Color del círculo de fondo por modo. El anillo sale de `theme.colors.backdropRing`. */
  backdrop: Record<Mode, string>;
  Drawing: ComponentType<DrawingProps>;
  /** Escena del nido en Patrimonio: el lugar que la mascota construye a medida que crece tu patrimonio. */
  Nest: ComponentType<NestProps>;
  story: { chapters: number };
}
