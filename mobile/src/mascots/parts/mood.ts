import type { Mode, Mood } from "../types";

/** Banderas derivadas de mood + modo, iguales para todas las mascotas. */
export function moodFlags(mood: Mood, mode: Mode) {
  const happy = mood === "feliz" || mood === "festeja";
  const bold = mode === "atrevido";
  return {
    happy,
    bold,
    /** Cejas altas: atento, o siempre en Atrevido. */
    up: mood === "atento" || bold,
    calm: mood === "calma",
    open: mood === "atento",
    celebrate: mood === "festeja",
    blush: happy ? 0.6 : mood === "calma" ? 0.35 : 0,
  };
}
