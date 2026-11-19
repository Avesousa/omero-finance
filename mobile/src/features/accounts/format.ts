import { formatMoney } from "../../i18n/format";

/** Monto con signo solo en movimientos: «−$ 48.300» sale, «+$ 30.000» entra, sin signo entre tus cuentas. */
export function formatSigned(amount: number, currency: "ARS" | "USD", plain = false): string {
  const base = formatMoney(Math.abs(amount), currency);
  if (plain || amount === 0) return base;
  return `${amount < 0 ? "−" : "+"}${base}`;
}
