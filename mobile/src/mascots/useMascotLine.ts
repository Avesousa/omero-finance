import { useTranslation } from "react-i18next";
import { useTheme } from "../design-system";
import { useMascot } from "./MascotProvider";
import type { MascotId, MascotMoment } from "./types";

type Vars = Record<string, string | number>;

/**
 * Frase de la mascota para un momento, según el modo actual:
 * `mascots:<id>.lines.<moment>.<mode>` con caída a `mascots:common.lines.<moment>.<mode>`.
 * `vars` interpola ({{amount}}, {{count}}); con `count` se resuelven los plurales.
 * Ejemplo: `useMascotLine("dailyRemainder", { amount: formatMoney(40866) })`.
 */
export function useMascotLine(moment: MascotMoment, vars?: Vars, id?: MascotId): string {
  const { mode } = useTheme();
  const { mascotId } = useMascot();
  const { t } = useTranslation("mascots");
  const key = id ?? mascotId;
  const translate = t as unknown as (keys: string[], options?: Vars) => string;
  return translate([`${key}.lines.${moment}.${mode}`, `common.lines.${moment}.${mode}`], vars);
}

/** Datos de texto de la historia de una mascota. */
export function useMascotStory(id?: MascotId) {
  const { mascotId } = useMascot();
  const { t } = useTranslation("mascots");
  const key = id ?? mascotId;
  const translate = t as unknown as (k: string) => string;
  return {
    name: translate(`${key}.name`),
    species: translate(`${key}.species`),
    oneLiner: translate(`${key}.story.oneLiner`),
    /** Título del capítulo 1..3. */
    chapterTitle: (n: number) => translate(`${key}.story.chapter${n}`),
  };
}

/** Textos del nido de una mascota (nombre y frase del capítulo según el modo actual). */
export function useMascotNest(id?: MascotId) {
  const { mascotId } = useMascot();
  const { mode } = useTheme();
  const { t } = useTranslation("mascots");
  const key = id ?? mascotId;
  const translate = t as unknown as (k: string) => string;
  return {
    /** "El nido de Omero", "La laguna de Pincho"… */
    name: translate(`${key}.nest.name`),
    /** Frase del capítulo 1..3 en la voz del modo. */
    caption: (chapter: number) => translate(`${key}.nest.caption.c${chapter}.${mode}`),
  };
}
