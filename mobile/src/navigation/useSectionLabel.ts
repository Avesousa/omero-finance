import { useTranslation } from "react-i18next";
import { useTheme } from "../design-system";
import { useMascot } from "../mascots";
import type { SectionKey } from "./sections";

/**
 * Nombre corto de una sección (barra de navegación). Todo sale de `tabs.json`, salvo Patrimonio
 * en Atrevido: nombre corto del lugar de la mascota (`mascots:<id>.nest.short`).
 */
export function useSectionLabel(key: SectionKey): string {
  const { mode } = useTheme();
  const { mascotId } = useMascot();
  const { t } = useTranslation(["tabs", "mascots"]);
  const translate = t as unknown as (k: string, o?: Record<string, string>) => string;
  if (key === "wealth" && mode === "atrevido") return translate(`mascots:${mascotId}.nest.short`);
  return translate(`tabs:${key}`);
}

/** Título de pantalla de una sección. Atrevido + Patrimonio: `mascots:<id>.nest.title`; el resto = label. */
export function useSectionTitle(key: SectionKey): string {
  const { mode } = useTheme();
  const { mascotId } = useMascot();
  const { t } = useTranslation("mascots");
  const label = useSectionLabel(key);
  const translate = t as unknown as (k: string) => string;
  if (key === "wealth" && mode === "atrevido") return translate(`${mascotId}.nest.title`);
  return label;
}
