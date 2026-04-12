import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return unauthorized();
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year  = parseInt(searchParams.get("year") ?? "0", 10);

  if (!month || !year) {
    return NextResponse.json({ error: "month y year requeridos" }, { status: 400 });
  }

  const { householdId } = session.user;

  const [
    incomes,
    tdcStatements,
    fixedTemplates,
    groceryAgg,
    householdAgg,
    personalAgg,
    tdcPaidStatements,
    fixedExpenseAgg,
  ] = await Promise.all([
    prisma.income.findMany({
      where: { householdId, month, year },
      select: { amount: true, amountArs: true },
    }),
    prisma.creditCardStatement.findMany({
      where: { householdId, month, year },
      select: { amountToPay: true, minimumPayment: true, payMinimum: true, committedOverride: true, usdAmount: true },
    }),
    prisma.fixedExpenseTemplate.findMany({
      where: { householdId, isActive: true, currency: "ARS" },
      select: { amount: true },
    }),
    prisma.groceryExpense.aggregate({
      where: { householdId, month, year },
      _sum: { amount: true },
    }),
    prisma.householdExpense.aggregate({
      where: { householdId, month, year },
      _sum: { amount: true },
    }),
    prisma.personalExpense.aggregate({
      where: { householdId, month, year },
      _sum: { amount: true },
    }),
    prisma.creditCardStatement.findMany({
      where: { householdId, month, year, isPaid: true },
      select: { amountToPay: true, minimumPayment: true, payMinimum: true, committedOverride: true, usdAmount: true },
    }),
    prisma.fixedExpense.aggregate({
      where: { householdId, month, year },
      _sum: { amount: true },
    }),
  ]);

  const total = incomes.reduce((s, i) => s + Number(i.amountArs ?? i.amount), 0);

  function tdcEffective(c: { amountToPay: unknown; minimumPayment: unknown; payMinimum: boolean; committedOverride: unknown }) {
    if (c.payMinimum && c.minimumPayment) return Number(c.minimumPayment);
    if (!c.payMinimum && c.committedOverride != null) return Number(c.committedOverride);
    return Number(c.amountToPay);
  }

  const tdcTotal   = tdcStatements.reduce((s, c) => s + tdcEffective(c), 0);
  const fixedTotal = fixedTemplates.reduce((s, t) => s + Number(t.amount), 0);

  const usedAmounts: Record<string, number> = {
    TDC:           tdcPaidStatements.reduce((s, c) => s + tdcEffective(c), 0),
    GASTOS_FIJOS:  Number(fixedExpenseAgg._sum.amount ?? 0),
    MERCADO:       Number(groceryAgg._sum.amount      ?? 0),
    GASTOS_LIBRES: Number(householdAgg._sum.amount    ?? 0),
    OTROS:         Number(personalAgg._sum.amount     ?? 0),
  };

  return NextResponse.json({ total, tdcTotal, fixedTotal, usedAmounts });
}
