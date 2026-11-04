import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { categoryIdOrNull, readBody, requireCard, v, withSession } from "@/lib/plan/server";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return withSession(req, "update", async (ctx) => {
    const { id } = await params;
    const body = await readBody(req);
    const purchase = await prisma.planCardPurchase.findUnique({ where: { id } });
    await ctx.assert(purchase, "update");
    // Tarjeta y categoría se validan contra la finanza DE LA COMPRA, no contra la activa.
    const householdId = purchase!.householdId;

    const data: Record<string, unknown> = {};
    if (body.cardId !== undefined) data.cardId = await requireCard(householdId, body.cardId);
    if (body.description !== undefined) data.description = v.text(body.description, "La descripción");
    if (body.amount !== undefined) data.amount = v.amount(body.amount);
    if (body.currency !== undefined) data.currency = v.currency(body.currency);
    if (body.installments !== undefined) data.installments = v.int(body.installments, "Cuotas", 1, 120);
    if (body.firstPeriod !== undefined) data.firstPeriod = v.nearPeriod(body.firstPeriod);
    if (body.categoryId !== undefined) {
      data.categoryId = await categoryIdOrNull(householdId, body.categoryId, "EXPENSE");
    }
    if (body.purchaseDate !== undefined) data.purchaseDate = v.optionalDate(body.purchaseDate);
    if (body.note !== undefined) data.note = v.optionalText(body.note);

    await prisma.planCardPurchase.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return withSession(req, "delete", async (ctx) => {
    const { id } = await params;
    await ctx.assert(await prisma.planCardPurchase.findUnique({ where: { id } }), "delete");
    await prisma.planCardPurchase.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
