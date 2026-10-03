import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, PAY_MODES, readBody, v, withSession } from "@/lib/plan/server";

type Params = { params: Promise<{ id: string }> };

async function findStatement(householdId: string, id: string) {
  const statement = await prisma.planCardStatement.findFirst({ where: { id, householdId } });
  if (!statement) throw new ApiError("No encontrado", 404);
  return statement;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return withSession(req, async ({ householdId }) => {
    const { id } = await params;
    const body = await readBody(req);
    await findStatement(householdId, id);

    const data: Record<string, unknown> = {};
    if (body.totalArs !== undefined) data.totalArs = v.amount(body.totalArs, "Monto total", { allowZero: true });
    if (body.minimumArs !== undefined) data.minimumArs = v.optionalAmount(body.minimumArs, "Pago mínimo");
    if (body.usdAmount !== undefined) data.usdAmount = v.optionalAmount(body.usdAmount, "Monto en dólares");
    if (body.dueDate !== undefined) data.dueDate = v.optionalDate(body.dueDate);
    if (body.payMode !== undefined) data.payMode = v.oneOf(body.payMode, PAY_MODES, "Forma de pago");
    if (body.customAmount !== undefined) data.customAmount = v.optionalAmount(body.customAmount, "Monto a pagar");
    if (body.isPaid !== undefined) {
      data.isPaid = body.isPaid === true;
      data.paidAt = body.isPaid === true ? new Date() : null;
    }

    await prisma.planCardStatement.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return withSession(req, async ({ householdId }) => {
    const { id } = await params;
    await findStatement(householdId, id);
    await prisma.planCardStatement.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
