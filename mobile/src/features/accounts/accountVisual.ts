import { palette } from "../../design-system/tokens/palette";
import { bankFor } from "../../domain/cardBrands";
import { bankColor } from "../../components/atoms";
import type { AccountDTO } from "./data";

export interface AccountLook { color: string; initials: string }

/** Color y sigla de una cuenta: el banco si se reconoce, verde para dólares, gris para efectivo, y el color de Omero para el resto. */
export function accountLook(a: Pick<AccountDTO, "name" | "type" | "currency">, fallback: { primary: string; muted: string; positive: string }): AccountLook {
  const bank = bankFor(a.name);
  if (bank) return { color: bankColor(a.name) ?? palette.black, initials: bank.initials };
  if (a.type === "CASH") return { color: fallback.muted, initials: "EF" };
  if (a.currency === "USD") return { color: fallback.positive, initials: "US$" };
  const words = a.name.trim().split(/\s+/);
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : a.name.slice(0, 2)).toUpperCase();
  return { color: fallback.primary, initials };
}
