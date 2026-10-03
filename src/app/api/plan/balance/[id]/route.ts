import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, readBody, v, withSession } from "@/lib/plan/server";

type Params = { params: Promise<{ id: string }> };

async function findItem(householdId: string, id: string) {
  const item = await prisma.planBalanceItem.findFirst({ where: { id, householdId } });
  if (!item) throw new ApiError("No encontrado", 404);
  return item;
}

/**
 * PATCH /api/plan/balance/[id]
 * Body: { name?, isArchived?, period?, amount? } — con period + amount guarda el saldo de ese mes.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withSession(req, async ({ householdId }) => {
    const { id } = await params;
    const body = await readBody(req);
    await findItem(householdId, id);

    const data: { name?: string; isArchived?: boolean } = {};
    if (body.name !== undefined) data.name = v.text(body.name, "El nombre", 60);
    if (body.isArchived !== undefined) data.isArchived = body.isArchived === true;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.planBalanceItem.update({ where: { id }, data });
      }
      if (body.amount !== undefined) {
        const period = v.nearPeriod(body.period);
        const amount = v.amount(body.amount, "Saldo", { allowZero: true });
        await tx.planBalanceValue.upsert({
          where: { itemId_period: { itemId: id, period } },
          create: { itemId: id, period, amount },
          update: { amount },
        });
      }
    });
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return withSession(req, async ({ householdId }) => {
    const { id } = await params;
    await findItem(householdId, id);
    await prisma.planBalanceItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
