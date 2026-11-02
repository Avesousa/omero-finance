import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { removeLoanBalance, setLoanBalance } from "@/lib/plan/loans";
import { readBody, v, withSession } from "@/lib/plan/server";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/plan/loans/[id]/balance — saldo según el banco.
 * Body: { period, amount } — el saldo al empezar `period`, antes de la cuota de ese mes.
 * Pisa el saldo calculado: desde ahí la cuenta sigue con las cuotas y el interés.
 */
export async function POST(req: NextRequest, { params }: Params) {
  return withSession(req, "update", async (ctx) => {
    const { id } = await params;
    const loan = await prisma.planLoan.findUnique({ where: { id }, select: { householdId: true } });
    await ctx.assert(loan, "update");
    const body = await readBody(req);
    const period = v.nearPeriod(body.period);
    const amount = v.amount(body.amount, "Saldo");
    await prisma.$transaction((tx) => setLoanBalance(tx, loan!.householdId, id, period, amount));
    return NextResponse.json({ ok: true }, { status: 201 });
  });
}

/** DELETE /api/plan/loans/[id]/balance?period=YYYY-MM — quita ese saldo cargado. */
export async function DELETE(req: NextRequest, { params }: Params) {
  return withSession(req, "update", async (ctx) => {
    const { id } = await params;
    const loan = await prisma.planLoan.findUnique({ where: { id }, select: { householdId: true } });
    await ctx.assert(loan, "update");
    const period = v.nearPeriod(new URL(req.url).searchParams.get("period"));
    await prisma.$transaction((tx) => removeLoanBalance(tx, loan!.householdId, id, period));
    return NextResponse.json({ ok: true });
  });
}
