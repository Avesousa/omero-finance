import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HOUSEHOLD_ID } from "../../../../prisma/constants";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year  = parseInt(searchParams.get("year") ?? "0", 10);

  if (!month || !year) {
    return NextResponse.json({ error: "month y year requeridos" }, { status: 400 });
  }

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
    // Income: use amount as fallback for ARS entries (same logic as dashboard.ts)
    prisma.income.findMany({
      where: { householdId: HOUSEHOLD_ID, month, year },
      select: { amount: true, amountArs: true },
    }),
    // All TDC statements — effective committed amount (respects payMinimum/committedOverride)
    prisma.creditCardStatement.findMany({
      where: { householdId: HOUSEHOLD_ID, month, year },
      select: { amountToPay: true, minimumPayment: true, payMinimum: true, committedOverride: true, usdAmount: true },
    }),
    prisma.fixedExpenseTemplate.findMany({
      where: { householdId: HOUSEHOLD_ID, isActive: true, currency: "ARS" },
      select: { amount: true },
    }),
    prisma.groceryExpense.aggregate({
      where: { householdId: HOUSEHOLD_ID, month, year },
      _sum: { amount: true },
    }),
    prisma.householdExpense.aggregate({
      where: { householdId: HOUSEHOLD_ID, month, year },
      _sum: { amount: true },
    }),
    prisma.personalExpense.aggregate({
      where: { householdId: HOUSEHOLD_ID, month, year },
      _sum: { amount: true },
    }),
    // Paid TDC only (for usedAmounts.TDC)
    prisma.creditCardStatement.findMany({
      where: { householdId: HOUSEHOLD_ID, month, year, isPaid: true },
      select: { amountToPay: true, minimumPayment: true, payMinimum: true, committedOverride: true, usdAmount: true },
    }),
    prisma.fixedExpense.aggregate({
      where: { householdId: HOUSEHOLD_ID, month, year },
      _sum: { amount: true },
    }),
  ]);

  // Income total: fallback to amount for ARS entries (matches dashboard.ts logic)
  const total = incomes.reduce((s, i) => s + Number(i.amountArs ?? i.amount), 0);

  // Effective TDC amount: respects payMinimum/committedOverride
  function tdcEffective(c: { amountToPay: unknown; minimumPayment: unknown; payMinimum: boolean; committedOverride: unknown; usdAmount: unknown }) {
    if (c.payMinimum && c.minimumPayment) return Number(c.minimumPayment);
    if (!c.payMinimum && c.committedOverride != null) return Number(c.committedOverride);
    return Number(c.amountToPay); // USD portion excluded from budget line here (no live rate on server)
  }

  const tdcTotal   = tdcStatements.reduce((s, c) => s + tdcEffective(c), 0);
  const fixedTotal = fixedTemplates.reduce((s, t) => s + Number(t.amount), 0);

  const usedAmounts: Record<string, number> = {
    TDC:          tdcPaidStatements.reduce((s, c) => s + tdcEffective(c), 0),
    GASTOS_FIJOS: Number(fixedExpenseAgg._sum.amount ?? 0),
    MERCADO:      Number(groceryAgg._sum.amount     ?? 0),
    GASTOS_LIBRES: Number(householdAgg._sum.amount  ?? 0),
    OTROS:        Number(personalAgg._sum.amount    ?? 0),
  };

  return NextResponse.json({ total, tdcTotal, fixedTotal, usedAmounts });
}
