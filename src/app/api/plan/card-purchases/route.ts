import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { categoryIdOrNull, readBody, requireCard, v, withSession } from "@/lib/plan/server";

/**
 * POST /api/plan/card-purchases — carga una compra con tarjeta.
 * Body: { cardId, description, amount, currency, installments, firstPeriod, categoryId, purchaseDate, note }
 */
export async function POST(req: NextRequest) {
  return withSession(req, async ({ householdId }) => {
    const body = await readBody(req);
    const created = await prisma.planCardPurchase.create({
      data: {
        householdId,
        cardId: await requireCard(householdId, body.cardId),
        description: v.text(body.description, "La descripción"),
        amount: v.amount(body.amount),
        currency: v.currency(body.currency),
        installments: v.int(body.installments ?? 1, "Cuotas", 1, 120),
        firstPeriod: v.nearPeriod(body.firstPeriod),
        categoryId: await categoryIdOrNull(householdId, body.categoryId, "EXPENSE"),
        purchaseDate: v.optionalDate(body.purchaseDate),
        note: v.optionalText(body.note),
      },
    });
    return NextResponse.json({ id: created.id }, { status: 201 });
  });
}
