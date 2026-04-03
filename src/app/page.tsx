export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { HOUSEHOLD_ID } from "../../prisma/constants";
import { BalanceCard } from "@/components/quick-log/balance-card";
import { ExpenseFormContainer } from "@/components/quick-log/expense-form-container";
import { type RecentExpense } from "@/components/quick-log/recent-expenses";
import { type RecentIncome } from "@/components/quick-log/recent-incomes";

const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

async function getPageData() {
  const now   = new Date();
  const month = MONTH_NAMES[now.getMonth()];
  const year  = now.getFullYear();

  // Latest exchange rate
  const latestRate = await prisma.exchangeRate.findFirst({
    orderBy: { date: "desc" },
  });
  const currentRate = latestRate ? Number(latestRate.usdArs) : 1477;

  // Prefetch all users for name lookup
  const users = await prisma.user.findMany({
    where: { householdId: HOUSEHOLD_ID },
    select: { id: true, name: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  // Parallel queries — last 15 expenses + last 10 incomes this month
  const [groceries, household, fixed, personal, recentIncomeRows] = await Promise.all([
    prisma.groceryExpense.findMany({
      where: { householdId: HOUSEHOLD_ID, month, year },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.householdExpense.findMany({
      where: { householdId: HOUSEHOLD_ID, month, year },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.fixedExpense.findMany({
      where: { householdId: HOUSEHOLD_ID, month, year },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.personalExpense.findMany({
      where: { householdId: HOUSEHOLD_ID, month, year },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.income.findMany({
      where: { householdId: HOUSEHOLD_ID, month, year },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const all: RecentExpense[] = [
    ...groceries.map((e) => ({
      id: e.id,
      description: e.description,
      amount: Number(e.amount),
      currency: e.currency as "ARS" | "USD",
      category: "mercado" as const,
      createdByName: userMap[e.createdById] ?? "?",
      createdAt: e.createdAt.toISOString(),
    })),
    ...household.map((e) => ({
      id: e.id,
      description: e.description,
      amount: Number(e.amount),
      currency: e.currency as "ARS" | "USD",
      category: "general" as const,
      createdByName: userMap[e.createdById] ?? "?",
      createdAt: e.createdAt.toISOString(),
    })),
    ...fixed.map((e) => ({
      id: e.id,
      description: e.concept,
      amount: Number(e.amount),
      currency: e.currency as "ARS" | "USD",
      category: "fijo" as const,
      createdByName: userMap[e.createdById] ?? "?",
      createdAt: e.createdAt.toISOString(),
    })),
    ...personal.map((e) => ({
      id: e.id,
      description: e.concept,
      amount: Number(e.amount),
      currency: e.currency as "ARS" | "USD",
      category: "personal" as const,
      createdByName: userMap[e.createdById] ?? "?",
      createdAt: e.createdAt.toISOString(),
    })),
  ];

  // Sort by createdAt desc, keep top 10
  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const recentExpenses = all.slice(0, 10);

  // Balance breakdown: parallel queries
  // Note: `amount` is always the native-currency amount.
  //       `amountArs` is only set for USD entries that were converted.
  //       For ARS entries, amountArs is null — we use `amount` directly.
  const [
    incomeRows,
    groceryRows,
    householdRows,
    personalRows,
    paidTdcRows,
    pendingTdcRows,
    fixedTemplates,
  ] = await Promise.all([
    prisma.income.findMany({
      where: { householdId: HOUSEHOLD_ID, month, year },
      select: { amount: true, amountArs: true, currency: true },
    }),
    prisma.groceryExpense.findMany({
      where: { householdId: HOUSEHOLD_ID, month, year },
      select: { amount: true, amountArs: true, currency: true },
    }),
    prisma.householdExpense.findMany({
      where: { householdId: HOUSEHOLD_ID, month, year },
      select: { amount: true, amountArs: true, currency: true },
    }),
    prisma.personalExpense.findMany({
      where: { householdId: HOUSEHOLD_ID, month, year },
      select: { amount: true, amountArs: true, currency: true },
    }),
    // Only PAID TDC reduces the real disponible
    prisma.creditCardStatement.findMany({
      where: { householdId: HOUSEHOLD_ID, month, year, isPaid: true },
      select: { amountToPay: true, minimumPayment: true, payMinimum: true, committedOverride: true, usdAmount: true },
    }),
    // Unpaid TDC = comprometido (pending) — respects payMinimum toggle
    prisma.creditCardStatement.findMany({
      where: { householdId: HOUSEHOLD_ID, month, year, isPaid: false },
      select: { amountToPay: true, minimumPayment: true, payMinimum: true, committedOverride: true, usdAmount: true },
    }),
    // Active fixed templates — used for committed calculation and form selector
    prisma.fixedExpenseTemplate.findMany({
      where: { householdId: HOUSEHOLD_ID, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, concept: true, amount: true, currency: true },
    }),
  ]);

  // Sum rows to ARS: for ARS entries use `amount`, for USD use `amountArs` (if converted)
  function toArs(rows: { amount: unknown; amountArs: unknown; currency: string }[]) {
    return rows.reduce((s, r) => {
      if (r.currency === "ARS") return s + Number(r.amount);
      if (r.amountArs != null)  return s + Number(r.amountArs); // USD converted
      return s; // USD not converted — ignore for ARS balance
    }, 0);
  }

  const totalIncome      = toArs(incomeRows);
  const spentGrocery     = toArs(groceryRows);
  const spentHousehold   = toArs(householdRows);
  const spentPersonal    = toArs(personalRows);
  function effectiveTdcAmount(rows: { amountToPay: unknown; minimumPayment: unknown; payMinimum: boolean; committedOverride: unknown; usdAmount: unknown }[]) {
    return rows.reduce((s, r) => {
      if (r.payMinimum && r.minimumPayment) return s + Number(r.minimumPayment);
      if (!r.payMinimum && r.committedOverride != null) return s + Number(r.committedOverride);
      const usdInArs = r.usdAmount ? Number(r.usdAmount) * currentRate : 0;
      return s + Number(r.amountToPay) + usdInArs;
    }, 0);
  }
  const paidTdc    = effectiveTdcAmount(paidTdcRows);
  const pendingTdc = effectiveTdcAmount(pendingTdcRows);
  const fixedTotal       = fixedTemplates.filter((t) => t.currency === "ARS").reduce((s, t) => s + Number(t.amount), 0);

  // Disponible real = ingreso − lo que ya salió de la cuenta
  const actualSpent  = spentGrocery + spentHousehold + spentPersonal + paidTdc;
  const availableArs = totalIncome - actualSpent;

  // Comprometido = lo que ya sabemos que tiene que salir pero aún no salió
  const committed = fixedTotal + pendingTdc;

  // USD income/expense separate totals
  const totalIncomeUsd = incomeRows
    .filter((r) => r.currency === "USD" && r.amountArs == null)
    .reduce((s, r) => s + Number(r.amount), 0);

  // Accounts snapshot
  const accountsRaw = await prisma.account.findMany({
    where: { householdId: HOUSEHOLD_ID },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, avatarColor: true } } },
  });
  const accounts = accountsRaw.map((a) => ({
    id:       a.id,
    name:     a.name,
    type:     a.type,
    currency: a.currency,
    balance:  Number(a.balance),
    user:     a.user,
  }));

  const recentIncomes: RecentIncome[] = recentIncomeRows.map((i) => ({
    id:            i.id,
    type:          i.type,
    amount:        Number(i.amount),
    currency:      i.currency as "ARS" | "USD",
    description:   i.description,
    createdByName: userMap[i.createdById] ?? "?",
    createdAt:     i.createdAt.toISOString(),
  }));

  const formTemplates = fixedTemplates.map((t) => ({
    id:       t.id,
    concept:  t.concept,
    amount:   Number(t.amount),
    currency: t.currency as "ARS" | "USD",
  }));

  return { month, year, currentRate, recentExpenses, recentIncomes, availableArs, committed, actualSpent, totalIncomeUsd, accounts, fixedTemplates: formTemplates };
}

export default async function HomePage() {
  const { month, year, currentRate, recentExpenses, recentIncomes, availableArs, committed, actualSpent, totalIncomeUsd, accounts, fixedTemplates } = await getPageData();

  return (
    <div className="flex flex-col gap-4 px-4 py-4 max-w-lg mx-auto">
      <BalanceCard
        availableArs={availableArs}
        committed={committed}
        actualSpent={actualSpent}
        totalIncomeUsd={totalIncomeUsd}
        accounts={accounts}
        month={month}
        year={year}
      />

      <ExpenseFormContainer
        currentRate={currentRate}
        recentExpenses={recentExpenses}
        recentIncomes={recentIncomes}
        fixedTemplates={fixedTemplates}
      />
    </div>
  );
}
