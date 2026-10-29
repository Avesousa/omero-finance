import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeMerchant, normalizeWalletCard } from "@/lib/plan/core";
import { RULE_MERCHANT, RULE_WALLET_CARD } from "@/lib/plan/inbox";
import {
  ApiError, categoryIdOrNull, readBody, requireCard, requireStartedMonth, v, withSession,
} from "@/lib/plan/server";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/plan/inbox/[id]/confirm
 * Body: { amount, currency, categoryId, date: "YYYY-MM-DD", name?, method: "DEBIT" | "CARD", cardId?, installments? }
 * DEBIT: gasto variable del mes de `date`. CARD: compra con tarjeta; la primera cuota
 * entra en el resumen del mes de `date`. Aprende comercio -> categoría y tarjeta de Wallet -> cómo se pagó.
 */
export async function POST(req: NextRequest, { params }: Params) {
  return withSession(req, async ({ householdId }) => {
    const { id } = await params;
    const item = await prisma.planInboxItem.findFirst({ where: { id, householdId } });
    if (!item) throw new ApiError("No encontrado", 404);
    if (item.status !== "PENDING") throw new ApiError("Este pago ya fue resuelto", 409);

    const body = await readBody(req);
    const amount = v.amount(body.amount);
    const currency = v.currency(body.currency);
    const categoryId = await categoryIdOrNull(householdId, body.categoryId, "EXPENSE");
    const date = v.optionalDate(body.date);
    if (!date || typeof body.date !== "string") throw new ApiError("Fecha inválida");
    const period = v.nearPeriod(body.date.slice(0, 7));
    const method = v.oneOf(body.method, ["DEBIT", "CARD"] as const, "Forma de pago");
    const name = v.optionalText(body.name, 120) ?? item.merchant ?? "Pago con Apple Pay";

    let cardId: string | null = null;
    let installments = 1;
    if (method === "CARD") {
      cardId = await requireCard(householdId, body.cardId);
      installments = v.int(body.installments ?? 1, "Cuotas", 1, 120);
    } else {
      await requireStartedMonth(householdId, period);
    }

    const merchantKey = item.merchant ? normalizeMerchant(item.merchant) : "";
    const walletKey = item.walletCard ? normalizeWalletCard(item.walletCard) : "";

    await prisma.$transaction(async (tx) => {
      // Tomar el pago primero: si otro pedido lo confirmó en paralelo, este corta acá.
      const claimed = await tx.planInboxItem.updateMany({
        where: { id, householdId, status: "PENDING" },
        data: { status: "CONFIRMED" },
      });
      if (claimed.count === 0) throw new ApiError("Este pago ya fue resuelto", 409);

      let entryId: string | null = null;
      let purchaseId: string | null = null;
      if (method === "DEBIT") {
        const entry = await tx.planEntry.create({
          data: {
            householdId, period, kind: "EXPENSE", name, amount, currency, categoryId,
            date, note: "Apple Pay", isDone: true,
          },
        });
        entryId = entry.id;
      } else {
        const purchase = await tx.planCardPurchase.create({
          data: {
            householdId, cardId: cardId!, description: name, amount, currency, installments,
            firstPeriod: period, categoryId, purchaseDate: date, note: "Apple Pay",
          },
        });
        purchaseId = purchase.id;
      }
      await tx.planInboxItem.update({ where: { id }, data: { entryId, purchaseId } });

      if (merchantKey && categoryId) {
        await tx.planInboxRule.upsert({
          where: { householdId_kind_key: { householdId, kind: RULE_MERCHANT, key: merchantKey } },
          create: { householdId, kind: RULE_MERCHANT, key: merchantKey, categoryId },
          update: { categoryId },
        });
      }
      if (walletKey) {
        await tx.planInboxRule.upsert({
          where: { householdId_kind_key: { householdId, kind: RULE_WALLET_CARD, key: walletKey } },
          create: { householdId, kind: RULE_WALLET_CARD, key: walletKey, cardId },
          update: { cardId },
        });
      }
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  });
}
