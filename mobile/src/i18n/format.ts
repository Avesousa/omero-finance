import i18n from "i18next";

const INTL: Record<string, string> = { es: "es-AR", "pt-BR": "pt-BR", en: "en-US" };

/** Locale de Intl según el idioma activo (es → es-AR, pt-BR → pt-BR, en → en-US). */
export function activeLocale(): string {
  return INTL[i18n.language] ?? "es-AR";
}

const nbsp = /[  ]/g;

/** Número con separadores del locale activo. */
export function formatNumber(value: number, fractionDigits = 0): string {
  try {
    return new Intl.NumberFormat(activeLocale(), {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
      .format(value)
      .replace(nbsp, " ");
  } catch {
    const [int, dec] = Math.abs(value).toFixed(fractionDigits).split(".");
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, activeLocale() === "en-US" ? "," : ".");
    return `${value < 0 ? "-" : ""}${grouped}${dec ? (activeLocale() === "en-US" ? "." : ",") + dec : ""}`;
  }
}

/**
 * Dinero con el locale activo. En es-AR: `$ 40.866` (símbolo, espacio, punto de miles).
 * Los pesos se muestran enteros (sin centavos).
 */
export function formatMoney(amount: number, currency: string = "ARS"): string {
  try {
    return new Intl.NumberFormat(activeLocale(), {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(amount)
      .replace(nbsp, " ")
      .replace(/^(-?)([^\d\s-]+)(\d)/, "$1$2 $3"); // garantiza espacio entre símbolo y cifra
  } catch {
    return `${amount < 0 ? "-" : ""}$ ${formatNumber(Math.abs(amount))}`;
  }
}

/** Porcentaje a partir de una fracción (0.43 → "43 %"). */
export function formatPercent(fraction: number, fractionDigits = 0): string {
  try {
    return new Intl.NumberFormat(activeLocale(), {
      style: "percent",
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
      .format(fraction)
      .replace(nbsp, " ");
  } catch {
    return `${formatNumber(fraction * 100, fractionDigits)} %`;
  }
}

export type DateStyle = "short" | "long" | "month" | "monthYear" | "time" | "dateTime";

/** Parsea 'YYYY-MM-DD', 'YYYY-MM' o 'YYYY-MM-DDTHH:mm' como hora local (sin corrimiento de zona). */
export function parseLocal(input: string | Date): Date {
  if (input instanceof Date) return input;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?(?:T(\d{2}):(\d{2}))?/.exec(input);
  if (!m) return new Date(input);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3] ?? 1), Number(m[4] ?? 0), Number(m[5] ?? 0));
}

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: "2-digit", month: "2-digit" }, // 10/11
  long: { day: "numeric", month: "long" }, // 10 de noviembre
  month: { month: "long" }, // noviembre
  monthYear: { month: "long", year: "numeric" }, // noviembre 2026
  time: { hour: "2-digit", minute: "2-digit", hour12: false }, // 09:12
  dateTime: { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false },
};

/** Fecha con el locale activo. Acepta ISO 'YYYY-MM-DD[THH:mm]', 'YYYY-MM' o Date. */
export function formatDate(input: string | Date, style: DateStyle = "short"): string {
  const date = parseLocal(input);
  try {
    // "noviembre 2026" (sin el "de" que agrega es-AR).
    if (style === "monthYear") {
      return `${formatDate(date, "month")} ${date.getFullYear()}`;
    }
    return new Intl.DateTimeFormat(activeLocale(), DATE_OPTIONS[style]).format(date).replace(nbsp, " ");
  } catch {
    const pad = (n: number) => String(n).padStart(2, "0");
    if (style === "time") return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
  }
}

/** Primera letra en mayúscula ("noviembre 2026" → "Noviembre 2026"). */
export function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase(activeLocale()) + text.slice(1);
}
