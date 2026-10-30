/**
 * Por confirmar — claves de API y bandeja de pagos que llegan solos (Apple Pay).
 * Solo servidor.
 */

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { normalizeMerchant, normalizeWalletCard, type Currency } from "./core";

export const TOKEN_PREFIX = "omr_";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Clave nueva: se muestra una sola vez; en la base queda solo el hash. */
export function createToken(): { token: string; tokenHash: string } {
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export type InboxMethod = "DEBIT" | "CARD";

export interface InboxItemDTO {
  id: string;
  source: string;
  merchant: string | null;
  amount: number | null;
  currency: Currency;
  walletCard: string | null;
  /** ISO completo (fecha y hora). */
  occurredAt: string;
  suggestedCategoryId: string | null;
  suggestedMethod: InboxMethod | null;
  suggestedCardId: string | null;
}

export const RULE_MERCHANT = "MERCHANT";
export const RULE_WALLET_CARD = "WALLET_CARD";

/** Pagos pendientes (los más nuevos primero) con las sugerencias que salen de lo ya confirmado. */
export async function loadInbox(householdId: string): Promise<InboxItemDTO[]> {
  const items = await prisma.planInboxItem.findMany({
    where: { householdId, status: "PENDING" },
    orderBy: { occurredAt: "desc" },
  });
  if (items.length === 0) return [];

  const [rules, categories, cards] = await Promise.all([
    prisma.planInboxRule.findMany({ where: { householdId } }),
    prisma.planCategory.findMany({ where: { householdId, kind: "EXPENSE", isArchived: false }, select: { id: true } }),
    prisma.card.findMany({ where: { householdId }, select: { id: true } }),
  ]);
  const categoryIds = new Set(categories.map((c) => c.id));
  const cardIds = new Set(cards.map((c) => c.id));
  const byKey = new Map(rules.map((r) => [`${r.kind}:${r.key}`, r]));

  return items.map((it) => {
    const mKey = it.merchant ? normalizeMerchant(it.merchant) : "";
    const wKey = it.walletCard ? normalizeWalletCard(it.walletCard) : "";
    const mRule = mKey ? byKey.get(`${RULE_MERCHANT}:${mKey}`) : undefined;
    const wRule = wKey ? byKey.get(`${RULE_WALLET_CARD}:${wKey}`) : undefined;

    const cat = mRule?.categoryId && categoryIds.has(mRule.categoryId) ? mRule.categoryId : null;
    let method: InboxMethod | null = null;
    let cardId: string | null = null;
    if (wRule) {
      if (wRule.cardId && cardIds.has(wRule.cardId)) {
        method = "CARD";
        cardId = wRule.cardId;
      } else if (!wRule.cardId) {
        method = "DEBIT";
      }
    }
    return {
      id: it.id,
      source: it.source,
      merchant: it.merchant,
      amount: it.amount == null ? null : Number(it.amount),
      currency: it.currency as Currency,
      walletCard: it.walletCard,
      occurredAt: it.occurredAt.toISOString(),
      suggestedCategoryId: cat,
      suggestedMethod: method,
      suggestedCardId: cardId,
    };
  });
}
