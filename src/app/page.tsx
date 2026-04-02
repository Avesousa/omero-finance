export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { HOUSEHOLD_ID } from "../../prisma/constants";
import { BalanceCard } from "@/components/quick-log/balance-card";
import { ExpenseFormContainer } from "@/components/quick-log/expense-form-container";
import { RecentExpenses, type RecentExpense } from "@/components/quick-log/recent-expenses";

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

  // Parallel queries — last 15 expenses this month across all types
  const [groceries, household, fixed, personal] = await Promise.all([
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

  // Rough "available" balance: income - sum of all expenses this month
  const [incomes, totalSpent] = await Promise.all([
    prisma.income.aggregate({
      where: { householdId: HOUSEHOLD_ID, month, year },
      _sum: { amount: true },
    }),
    Promise.all([
      prisma.groceryExpense.aggregate({ where: { householdId: HOUSEHOLD_ID, month, year }, _sum: { amount: true } }),
      prisma.householdExpense.aggregate({ where: { householdId: HOUSEHOLD_ID, month, year }, _sum: { amount: true } }),
      prisma.fixedExpense.aggregate({ where: { householdId: HOUSEHOLD_ID, month, year }, _sum: { amount: true } }),
      prisma.personalExpense.aggregate({ where: { householdId: HOUSEHOLD_ID, month, year }, _sum: { amount: true } }),
      prisma.rentPayment.aggregate({ where: { householdId: HOUSEHOLD_ID, month, year }, _sum: { amount: true } }),
      prisma.creditCardStatement.aggregate({ where: { householdId: HOUSEHOLD_ID, month, year }, _sum: { amountToPay: true } }),
    ]),
  ]);

  const totalIncome = Number(incomes._sum.amount ?? 0);
  const totalExpenses = totalSpent.reduce((s, r) => {
    const v = (r._sum as Record<string, unknown>).amount ?? (r._sum as Record<string, unknown>).amountToPay ?? 0;
    return s + Number(v);
  }, 0);
  const availableArs = totalIncome - totalExpenses;

  return { month, year, currentRate, recentExpenses, availableArs };
}

export default async function HomePage() {
  const { month, year, currentRate, recentExpenses, availableArs } = await getPageData();

  return (
    <div className="flex flex-col gap-4 px-4 py-4 max-w-lg mx-auto">
      <BalanceCard
        availableArs={availableArs}
        availableUsd={0}
        month={month}
        year={year}
      />

      <ExpenseFormContainer currentRate={currentRate} />

      <section>
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-3 px-1"
          style={{ color: "var(--text-secondary)" }}
        >
          Últimos gastos
        </h2>
        <RecentExpenses expenses={recentExpenses} />
      </section>
    </div>
  );
}
