import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addPastPayments, removeOldestPastPayment } from "@/lib/plan/loans";
import { readBody, v, withSession } from "@/lib/plan/server";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/plan/loans/[id]/past-payments — carga cuotas que ya estaban pagadas.
 * Body: { count, amount?, before? }
 * Quedan como pagadas en los meses anteriores a la primera cuota existente
 * (o a `before` si todavía no hay ninguna).
 */
export async function POST(req: NextRequest, { params }: Params) {
  return withSession(req, "update", async (ctx) => {
    const { id } = await params;
    const loan = await prisma.planLoan.findUnique({ where: { id }, select: { householdId: true } });
    await ctx.assert(loan, "update");
    const body = await readBody(req);
    const count = v.int(body.count, "Cantidad de cuotas", 1, 360);
    const amount = body.amount == null || body.amount === "" ? undefined : v.amount(body.amount, "Monto de la cuota");
    const before = body.before === undefined ? undefined : v.nearPeriod(body.before);

    const created = await prisma.$transaction((tx) => addPastPayments(tx, loan!.householdId, id, { count, amount, before }));
    return NextResponse.json({ ok: true, created }, { status: 201 });
  });
}

/** DELETE /api/plan/loans/[id]/past-payments — quita la cuota anterior más antigua. */
export async function DELETE(req: NextRequest, { params }: Params) {
  return withSession(req, "update", async (ctx) => {
    const { id } = await params;
    const loan = await prisma.planLoan.findUnique({ where: { id }, select: { householdId: true } });
    await ctx.assert(loan, "update");
    await prisma.$transaction((tx) => removeOldestPastPayment(tx, loan!.householdId, id));
    return NextResponse.json({ ok: true });
  });
}
