import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PAY_MODES, readBody, v, withSession } from "@/lib/plan/server";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return withSession(req, "update", async (ctx) => {
    const { id } = await params;
    const body = await readBody(req);
    await ctx.assert(await prisma.planCardStatement.findUnique({ where: { id } }), "update");

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
  return withSession(req, "delete", async (ctx) => {
    const { id } = await params;
    await ctx.assert(await prisma.planCardStatement.findUnique({ where: { id } }), "delete");
    await prisma.planCardStatement.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
