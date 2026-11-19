import { v } from "./server";

export const CARD_TYPES = ["VISA", "MC", "AMEX", "CABAL", "DINERS", "OTHER"] as const;
const TYPE_NAME: Record<(typeof CARD_TYPES)[number], string> = { VISA: "VISA", MC: "MC", AMEX: "AMEX", CABAL: "CABAL", DINERS: "DINERS", OTHER: "TDC" };

/**
 * Valida los datos de una tarjeta. El nombre lo elige quien la carga («Visa Galicia personal»); si no viene,
 * se arma con la convención de la app clásica («VISA Galicia» + titular si lo hay). El titular es opcional:
 * si no viene, no se toca el que ya tenía.
 */
export function cardFields(body: Record<string, unknown>) {
  const cardType = v.oneOf(body.cardType, CARD_TYPES, "Tipo de tarjeta");
  const entity = v.text(body.entity, "El banco", 40);
  const ownerName = v.optionalText(body.ownerName, 40) ?? undefined;
  const custom = v.optionalText(body.name, 60);
  const name = custom ?? [TYPE_NAME[cardType], entity, ownerName].filter(Boolean).join(" ");
  return { cardType, entity, name, ...(ownerName ? { ownerName } : {}) };
}
