import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HOUSEHOLD_ID } from "../../../../prisma/constants";

/**
 * GET /api/balance?month=enero&year=2026
 * Returns estimated available ARS for the month and total USD savings.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year  = parseInt(searchParams.get("year") ?? "0", 10);

  if (!month || !year) {
    return NextResponse.json({ error: "month y year requeridos" }, { status: 400 });
  }

  const where = { householdId: HOUSEHOLD_ID, month, year };

  const [
    incomeAgg,
    fixedAgg,
    groceryAgg,
    householdAgg,
    personalAgg,
    paidTdcAgg,
    usdSavingsAgg,
  ] = await Promise.all([
    prisma.income.aggregate({
      where,
      _sum: { amountArs: true },
    }),
    prisma.fixedExpense.aggregate({
      where,
      _sum: { amountArs: true },
    }),
    prisma.groceryExpense.aggregate({
      where,
      _sum: { amountArs: true },
    }),
    prisma.householdExpense.aggregate({
      where,
      _sum: { amountArs: true },
    }),
    prisma.personalExpense.aggregate({
      where,
      _sum: { amountArs: true },
    }),
    // Only count TDC statements that are already paid
    prisma.creditCardStatement.aggregate({
      where: { ...where, isPaid: true },
      _sum: { amountToPay: true },
    }),
    // All-time USD savings (savings accumulate across months)
    prisma.saving.aggregate({
      where: { householdId: HOUSEHOLD_ID, currency: "USD" },
      _sum: { amount: true },
    }),
  ]);

  const income     = Number(incomeAgg._sum.amountArs    ?? 0);
  const fixed      = Number(fixedAgg._sum.amountArs     ?? 0);
  const grocery    = Number(groceryAgg._sum.amountArs   ?? 0);
  const household  = Number(householdAgg._sum.amountArs ?? 0);
  const personal   = Number(personalAgg._sum.amountArs  ?? 0);
  const paidTdc    = Number(paidTdcAgg._sum.amountToPay ?? 0);
  const usdSavings = Number(usdSavingsAgg._sum.amount   ?? 0);

  const availableArs = income - fixed - grocery - household - personal - paidTdc;

  return NextResponse.json({ availableArs, usdSavings });
}
