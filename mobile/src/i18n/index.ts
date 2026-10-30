import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import { NAMESPACES, resources } from "./resources";

export const SUPPORTED_LANGUAGES = ["es", "pt-BR", "en"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** Idiomas con textos completos. Por ahora solo español; el resto cae a es hasta completarse. */
export const SUPPORTED_ENABLED: readonly Language[] = ["es"];
export const FALLBACK_LANGUAGE: Language = "es";

/** Locale de Intl por idioma de la app. */
export const INTL_LOCALE: Record<Language, string> = { es: "es-AR", "pt-BR": "pt-BR", en: "en-US" };

/** Idioma del dispositivo si está habilitado; si no, español. */
function pickLanguage(): Language {
  try {
    const tag = getLocales()[0]?.languageTag ?? "";
    const match = SUPPORTED_ENABLED.find((l) => tag.toLowerCase().startsWith(l.toLowerCase().split("-")[0]));
    return match ?? FALLBACK_LANGUAGE;
  } catch {
    return FALLBACK_LANGUAGE;
  }
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: pickLanguage(),
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    ns: [...NAMESPACES],
    defaultNS: "common",
    returnEmptyString: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    initAsync: false,
  });
}

/** Idioma activo normalizado a los soportados. */
export function currentLanguage(): Language {
  const lng = i18n.language as Language;
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lng) ? lng : FALLBACK_LANGUAGE;
}

export function setLanguage(lng: Language): Promise<unknown> {
  return i18n.changeLanguage(lng);
}

export default i18n;
export { useTranslation } from "react-i18next";
export { formatMoney, formatMoneyCompact, formatDate, formatPercent, formatNumber, formatPeriod } from "./format";
