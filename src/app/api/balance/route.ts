import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";

/**
 * GET /api/balance?month=enero&year=2026
 *
 * Disponible total (Q1 fix):
 *   totalArs = ingresos_ars + (fondoUsd × rate_hoy) - gastos_ars
 *
 * El fondoUsd es informativo — muestra cuánto del disponible proviene de USD.
 */
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
  const where = { householdId, month, year };

  const [
    incomes,
    fixedAgg,
    groceryAgg,
    householdAgg,
    personalAgg,
    paidTdcAgg,
    latestRate,
  ] = await Promise.all([
    // Fetch all incomes to compute ARS + USD separately
    prisma.income.findMany({
      where,
      select: { amount: true, amountArs: true, currency: true, dollarRateSnapshot: true },
    }),
    prisma.fixedExpense.aggregate({ where, _sum: { amountArs: true, amount: true } }),
    prisma.groceryExpense.aggregate({ where, _sum: { amountArs: true, amount: true } }),
    prisma.householdExpense.aggregate({ where, _sum: { amountArs: true, amount: true } }),
    prisma.personalExpense.aggregate({ where, _sum: { amountArs: true, amount: true } }),
    prisma.creditCardStatement.aggregate({
      where: { ...where, isPaid: true },
      _sum: { amountToPay: true },
    }),
    prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } }),
  ]);

  const rateHoy = latestRate ? Number(latestRate.usdArs) : 0;

  // Split incomes: ARS income and USD income (not converted)
  let incomeArs = 0;
  let fondoUsd  = 0;

  for (const income of incomes) {
    if (income.currency === "USD" && !income.amountArs) {
      // USD not converted — goes to USD fund
      fondoUsd += Number(income.amount);
    } else {
      // ARS or converted USD — use amountArs (fallback to amount for ARS)
      incomeArs += Number(income.amountArs ?? income.amount);
    }
  }

  // Sum all expenses in ARS (amountArs ?? amount for ARS-only records)
  const fixed     = Number(fixedAgg._sum.amountArs     ?? fixedAgg._sum.amount     ?? 0);
  const grocery   = Number(groceryAgg._sum.amountArs   ?? groceryAgg._sum.amount   ?? 0);
  const household = Number(householdAgg._sum.amountArs ?? householdAgg._sum.amount ?? 0);
  const personal  = Number(personalAgg._sum.amountArs  ?? personalAgg._sum.amount  ?? 0);
  const paidTdc   = Number(paidTdcAgg._sum.amountToPay ?? 0);

  const totalExpenses     = fixed + grocery + household + personal + paidTdc;
  const usdEquivalentArs  = fondoUsd * rateHoy;

  // Q1: USD fund is included in the total available (converted at today's rate)
  const totalArs = incomeArs + usdEquivalentArs - totalExpenses;

  return NextResponse.json({
    totalArs,          // disponible total en ARS (incluye USD × rate_hoy)
    fondoUsd,          // dólares acumulados sin convertir (informativo)
    usdEquivalentArs,  // fondoUsd × rate_hoy
    rateHoy,           // tipo de cambio del día
    comprometidoArs: totalExpenses,
  });
}
