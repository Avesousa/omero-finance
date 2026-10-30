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
      // ARS como "$"; otras monedas con símbolo explícito ("US$") para no confundirlas.
      currencyDisplay: currency === "ARS" ? "narrowSymbol" : "symbol",
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

export interface MoneyParts {
  /** "-" para negativos, "" si no. */
  sign: string;
  symbol: string;
  /** Parte entera con separadores de miles ("100.000.000"). */
  integer: string;
  /** Siempre 2 dígitos ("00"). */
  decimals: string;
  decimalSeparator: string;
}

/** Dinero partido para mostrar los decimales con otro estilo (siempre 2 decimales). */
export function formatMoneyParts(amount: number, currency: string = "ARS"): MoneyParts {
  const locale = activeLocale();
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: currency === "ARS" ? "narrowSymbol" : "symbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).formatToParts(amount);
    const pick = (type: string) =>
      parts
        .filter((p) => p.type === type)
        .map((p) => p.value)
        .join("")
        .replace(nbsp, " ")
        .trim();
    const integer = parts
      .filter((p) => p.type === "integer" || p.type === "group")
      .map((p) => p.value)
      .join("");
    const decimals = pick("fraction");
    if (!integer || !decimals) throw new Error("incomplete parts");
    return {
      sign: parts.some((p) => p.type === "minusSign") ? "-" : "",
      symbol: pick("currency"),
      integer,
      decimals,
      decimalSeparator: pick("decimal") || (locale === "en-US" ? "." : ","),
    };
  } catch {
    const en = locale === "en-US";
    const [int, dec] = Math.abs(amount).toFixed(2).split(".");
    return {
      sign: amount < 0 ? "-" : "",
      symbol: currency === "ARS" ? "$" : currency === "USD" ? "US$" : currency,
      integer: int.replace(/\B(?=(\d{3})+(?!\d))/g, en ? "," : "."),
      decimals: dec,
      decimalSeparator: en ? "." : ",",
    };
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

/**
 * Período 'YYYY-MM' legible: `long` → "noviembre 2026" (usar `capitalize` si va solo),
 * `short` → "nov" (etiquetas de gráficos).
 */
export function formatPeriod(period: string, style: "long" | "short" = "long"): string {
  if (style === "long") return formatDate(period, "monthYear");
  const date = parseLocal(period);
  try {
    return new Intl.DateTimeFormat(activeLocale(), { month: "short" }).format(date).replace(".", "");
  } catch {
    return formatDate(date, "month").slice(0, 3);
  }
}

/** Sufijos de miles/millones por locale (Hermes no garantiza `notation: "compact"`). */
const COMPACT_SUFFIX: Record<string, { k: string; m: string }> = {
  "es-AR": { k: "mil", m: "M" },
  "pt-BR": { k: "mil", m: "mi" },
  "en-US": { k: "K", m: "M" },
};

/** Monto abreviado para gráficos: `$ 2,5 M`, `$ 399 mil`. */
export function formatMoneyCompact(amount: number, currency: string = "ARS"): string {
  const abs = Math.abs(amount);
  if (abs < 1000) return formatMoney(amount, currency);
  const suffix = COMPACT_SUFFIX[activeLocale()] ?? COMPACT_SUFFIX["es-AR"];
  const [value, unit, digits] = abs >= 1_000_000 ? [abs / 1_000_000, suffix.m, 1] : [abs / 1000, suffix.k, abs < 10_000 ? 1 : 0];
  const symbol = formatMoney(0, currency).replace(/[\d\s.,]/g, "");
  return `${amount < 0 ? "-" : ""}${symbol} ${formatNumber(value, digits).replace(/[,.]0$/, "")} ${unit}`;
}
