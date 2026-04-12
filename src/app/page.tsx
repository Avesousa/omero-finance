export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";
import { calculateGastosLibres, calculatePerUserBudget } from "@/lib/budget";
import { HomeClient } from "@/components/quick-log/home-client";
import { type RecentExpense } from "@/components/quick-log/recent-expenses";
import { type RecentIncome } from "@/components/quick-log/recent-incomes";

const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

async function getPageData(householdId: string, userId: string) {
  const now   = new Date();
  const month = MONTH_NAMES[now.getMonth()];
  const year  = now.getFullYear();

  const latestRate = await prisma.exchangeRate.findFirst({
    orderBy: { date: "desc" },
  });
  const currentRate = latestRate ? Number(latestRate.usdArs) : 1477;

  const users = await prisma.user.findMany({
    where: { householdId },
    select: { id: true, name: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  const [groceries, household, fixed, personal, recentIncomeRows] = await Promise.all([
    prisma.groceryExpense.findMany({
      where: { householdId, month, year },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.householdExpense.findMany({
      where: { householdId, month, year },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.fixedExpense.findMany({
      where: { householdId, month, year },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.personalExpense.findMany({
      where: { householdId, month, year },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.income.findMany({
      where: { householdId, month, year },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const all: RecentExpense[] = [
    ...groceries.map((e) => ({
      id: e.id, description: e.description, amount: Number(e.amount),
      currency: e.currency as "ARS" | "USD", category: "mercado" as const,
      createdByName: userMap[e.createdById] ?? "?", createdAt: e.createdAt.toISOString(),
    })),
    ...household.map((e) => ({
      id: e.id, description: e.description, amount: Number(e.amount),
      currency: e.currency as "ARS" | "USD", category: "general" as const,
      createdByName: userMap[e.createdById] ?? "?", createdAt: e.createdAt.toISOString(),
    })),
    ...fixed.map((e) => ({
      id: e.id, description: e.concept, amount: Number(e.amount),
      currency: e.currency as "ARS" | "USD", category: "fijo" as const,
      createdByName: userMap[e.createdById] ?? "?", createdAt: e.createdAt.toISOString(),
    })),
    ...personal.map((e) => ({
      id: e.id, description: e.concept, amount: Number(e.amount),
      currency: e.currency as "ARS" | "USD", category: "personal" as const,
      createdByName: userMap[e.createdById] ?? "?", createdAt: e.createdAt.toISOString(),
    })),
  ];

  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const recentExpenses = all.slice(0, 10);

  const [
    incomeRows, groceryRows, householdRows, personalRows,
    paidTdcRows, pendingTdcRows, fixedTemplates, dbCards,
  ] = await Promise.all([
    prisma.income.findMany({ where: { householdId, month, year }, select: { amount: true, amountArs: true, currency: true, type: true, createdById: true } }),
    prisma.groceryExpense.findMany({ where: { householdId, month, year }, select: { amount: true, amountArs: true, currency: true } }),
    prisma.householdExpense.findMany({ where: { householdId, month, year }, select: { amount: true, amountArs: true, currency: true } }),
    prisma.personalExpense.findMany({ where: { householdId, month, year }, select: { amount: true, amountArs: true, currency: true } }),
    prisma.creditCardStatement.findMany({ where: { householdId, month, year, isPaid: true }, select: { amountToPay: true, minimumPayment: true, payMinimum: true, committedOverride: true, usdAmount: true } }),
    prisma.creditCardStatement.findMany({ where: { householdId, month, year, isPaid: false }, select: { amountToPay: true, minimumPayment: true, payMinimum: true, committedOverride: true, usdAmount: true } }),
    prisma.fixedExpenseTemplate.findMany({ where: { householdId, isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, concept: true, amount: true, currency: true } }),
    prisma.card.findMany({ where: { householdId }, orderBy: { name: "asc" }, select: { id: true, name: true, entity: true, cardType: true, ownerName: true } }),
  ]);

  function toArs(rows: { amount: unknown; amountArs: unknown; currency: string }[]) {
    return rows.reduce((s, r) => {
      if (r.currency === "ARS") return s + Number(r.amount);
      if (r.amountArs != null)  return s + Number(r.amountArs);
      return s;
    }, 0);
  }

  function effectiveTdcAmount(rows: { amountToPay: unknown; minimumPayment: unknown; payMinimum: boolean; committedOverride: unknown; usdAmount: unknown }[]) {
    return rows.reduce((s, r) => {
      if (r.payMinimum && r.minimumPayment) return s + Number(r.minimumPayment);
      if (!r.payMinimum && r.committedOverride != null) return s + Number(r.committedOverride);
      const usdInArs = r.usdAmount ? Number(r.usdAmount) * currentRate : 0;
      return s + Number(r.amountToPay) + usdInArs;
    }, 0);
  }

  const totalIncome    = toArs(incomeRows);
  const spentGrocery   = toArs(groceryRows);
  const spentHousehold = toArs(householdRows);
  const spentPersonal  = toArs(personalRows);
  const paidTdc        = effectiveTdcAmount(paidTdcRows);
  const pendingTdc     = effectiveTdcAmount(pendingTdcRows);
  const fixedTotal     = fixedTemplates.filter((t) => t.currency === "ARS").reduce((s, t) => s + Number(t.amount), 0);

  const actualSpent  = spentGrocery + spentHousehold + spentPersonal + paidTdc;
  const availableArs = totalIncome - actualSpent;
  const committed    = fixedTotal + pendingTdc;

  // Q1: USD income not converted — goes to USD fund (shown separately)
  const totalIncomeUsd = incomeRows
    .filter((r) => r.currency === "USD" && r.amountArs == null)
    .reduce((s, r) => s + Number(r.amount), 0);

  // ── Gastos libres: my proportional share of household free pool ─────────────
  // 1. Check if there's a manually configured amount in the budget config
  const gastosLibresCfg = await prisma.budgetConfig.findFirst({
    where: { householdId, month, year, category: "GASTOS_LIBRES" },
    select: { manualAmount: true, manualPercentage: true },
  });

  // 2. Compute the pool — manual config wins; fallback uses SUELDO-only income base
  const sueldoTotal = incomeRows
    .filter((r) => r.type === "SUELDO")
    .reduce((s, r) => s + (r.currency === "ARS" ? Number(r.amount) : Number(r.amountArs ?? 0)), 0);

  let gastosLibresPool: number;
  if (gastosLibresCfg?.manualAmount) {
    gastosLibresPool = Number(gastosLibresCfg.manualAmount);
  } else if (gastosLibresCfg?.manualPercentage) {
    gastosLibresPool = sueldoTotal * Number(gastosLibresCfg.manualPercentage);
  } else {
    // Auto: only use SUELDO income as base (not investments/savings)
    const totalTdc = effectiveTdcAmount([...paidTdcRows, ...pendingTdcRows]);
    gastosLibresPool = calculateGastosLibres(sueldoTotal, [
      fixedTotal, totalTdc, spentGrocery, spentHousehold,
    ]);
  }

  // My proportion based on SUELDO income; equal split if no salary data
  const sueldoByUser: Record<string, number> = {};
  for (const r of incomeRows) {
    if (r.type === "SUELDO") {
      sueldoByUser[r.createdById] = (sueldoByUser[r.createdById] ?? 0) + Number(r.amount);
    }
  }
  const userSplits = users.map((u) => ({ userId: u.id, name: u.name, incomeArs: sueldoByUser[u.id] ?? 0 }));
  const totalSueldo = userSplits.reduce((s, u) => s + u.incomeArs, 0);
  const splitMap = totalSueldo > 0
    ? calculatePerUserBudget(gastosLibresPool, userSplits)
    : Object.fromEntries(users.map((u) => [u.id, gastosLibresPool / users.length]));
  const myGastosLibres = splitMap[userId] ?? 0;

  const [
    accountsRaw,
    myIncomeRows,
    myPersonalExpRows,
    myRecentPersonalRows,
  ] = await Promise.all([
    prisma.account.findMany({
      where: { householdId },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, avatarColor: true } } },
    }),
    prisma.income.findMany({
      where: { householdId, month, year, createdById: userId, isPersonal: true },
      select: { amount: true, amountArs: true, currency: true },
    }),
    prisma.personalExpense.findMany({
      where: { householdId, month, year, userId },
      select: { amount: true, amountArs: true, currency: true },
    }),
    prisma.personalExpense.findMany({
      where: { householdId, month, year, userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const accounts = accountsRaw.map((a) => ({
    id: a.id, name: a.name, type: a.type, currency: a.currency,
    balance: Number(a.balance), user: a.user,
  }));

  const personalOnlyIncomeArs = toArs(myIncomeRows);
  const myPersonalSpentArs    = toArs(myPersonalExpRows);
  const myAvailableArs        = myGastosLibres + personalOnlyIncomeArs - myPersonalSpentArs;

  const myRecentExpenses: RecentExpense[] = myRecentPersonalRows.map((e) => ({
    id: e.id, description: e.concept, amount: Number(e.amount),
    currency: e.currency as "ARS" | "USD", category: "personal" as const,
    createdByName: userMap[e.createdById] ?? "?", createdAt: e.createdAt.toISOString(),
  }));

  const recentIncomes: RecentIncome[] = recentIncomeRows.map((i) => ({
    id: i.id, type: i.type, amount: Number(i.amount),
    currency: i.currency as "ARS" | "USD", description: i.description,
    createdByName: userMap[i.createdById] ?? "?", createdAt: i.createdAt.toISOString(),
  }));

  const formTemplates = fixedTemplates.map((t) => ({
    id: t.id, concept: t.concept, amount: Number(t.amount), currency: t.currency as "ARS" | "USD",
  }));
  const cardNames = dbCards;

  return {
    month, year, currentRate,
    recentExpenses, recentIncomes,
    availableArs, committed, actualSpent, totalIncomeUsd,
    accounts, fixedTemplates: formTemplates,
    myAvailableArs, myGastosLibres, personalOnlyIncomeArs, myPersonalSpentArs, myRecentExpenses,
    cardNames,
  };
}

export default async function HomePage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const data = await getPageData(session.user.householdId, session.user.id);

  return (
    <div className="flex flex-col gap-4 px-4 py-4 max-w-lg mx-auto">
      <HomeClient
        userName={session.user.name}
        userId={session.user.id}
        month={data.month}
        year={data.year}
        currentRate={data.currentRate}
        accounts={data.accounts}
        fixedTemplates={data.fixedTemplates}
        cards={data.cardNames}
        recentIncomes={data.recentIncomes}
        // casa
        availableArs={data.availableArs}
        committed={data.committed}
        actualSpent={data.actualSpent}
        totalIncomeUsd={data.totalIncomeUsd}
        recentExpenses={data.recentExpenses}
        // personal
        myAvailableArs={data.myAvailableArs}
        myGastosLibres={data.myGastosLibres}
        personalOnlyIncomeArs={data.personalOnlyIncomeArs}
        myPersonalSpentArs={data.myPersonalSpentArs}
        myRecentExpenses={data.myRecentExpenses}
      />
    </div>
  );
}
