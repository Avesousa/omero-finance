import { formatMoneyParts } from "../../i18n/format";

/** Puntos de un monto oculto (ojito de Inicio). */
export const MASKED_AMOUNT = "••••";

/** Monto oculto con el símbolo de la moneda: "$ ••••". */
export function maskedMoney(currency = "ARS"): string {
  return `${formatMoneyParts(0, currency).symbol} ${MASKED_AMOUNT}`;
}
