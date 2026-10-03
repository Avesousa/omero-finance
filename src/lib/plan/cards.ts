import { v } from "./server";

export const CARD_TYPES = ["VISA", "MC", "AMEX"] as const;

/**
 * Valida los datos de una tarjeta y arma el nombre con la misma convención
 * que la app clásica ("VISA Galicia Avelino"), para que ambas la muestren igual.
 */
export function cardFields(body: Record<string, unknown>) {
  const cardType = v.oneOf(body.cardType, CARD_TYPES, "Tipo de tarjeta");
  const entity = v.text(body.entity, "El banco", 40);
  const ownerName = v.text(body.ownerName, "El titular", 40);
  return { cardType, entity, ownerName, name: `${cardType} ${entity} ${ownerName}` };
}
