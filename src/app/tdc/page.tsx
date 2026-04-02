import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { HOUSEHOLD_ID } from "../../../prisma/constants";
import { MONTH_NAMES, type MonthName } from "@/lib/dashboard";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { StatementsList, type StatementData } from "@/components/tdc/statements-list";
import { CardExpenses, type CardExpense } from "@/components/tdc/card-expenses";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string; tab?: string }>;
}

export default async function TdcPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const now    = new Date();

  const month = (
    params.month && MONTH_NAMES.includes(params.month as MonthName)
      ? params.month
      : MONTH_NAMES[now.getMonth()]
  ) as MonthName;
  const year = params.year ? parseInt(params.year, 10) : now.getFullYear();
  const tab  = params.tab === "gastos" ? "gastos" : "resumenes";

  // Fetch users for name lookup
  const users = await prisma.user.findMany({
    where: { householdId: HOUSEHOLD_ID },
    select: { id: true, name: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  // Fetch statements for the month
  const statements = await prisma.creditCardStatement.findMany({
    where: { householdId: HOUSEHOLD_ID, month, year },
    orderBy: { cardName: "asc" },
  });

  const now2   = new Date();
  const statementsData: StatementData[] = statements.map((s) => {
    const msLeft     = new Date(s.dueDate).getTime() - now2.getTime();
    const daysUntilDue = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    return {
      id:             s.id,
      cardName:       s.cardName,
      totalAmountArs: Number(s.totalAmountArs),
      amountToPay:    Number(s.amountToPay),
      dueDate:        s.dueDate.toISOString(),
      minimumPayment: s.minimumPayment ? Number(s.minimumPayment) : null,
      isPaid:         s.isPaid,
      daysUntilDue,
    };
  });

  // Fetch card expenses for the month (expenses with a cardName set)
  const [householdExps, groceryExps, personalExps] = await Promise.all([
    prisma.householdExpense.findMany({
      where: { householdId: HOUSEHOLD_ID, month, year, cardName: { not: null } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.groceryExpense.findMany({
      where: { householdId: HOUSEHOLD_ID, month, year, cardName: { not: null } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.personalExpense.findMany({
      where: { householdId: HOUSEHOLD_ID, month, year, cardName: { not: null } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const cardExpenses: CardExpense[] = [
    ...householdExps.map((e) => ({
      id:            e.id,
      description:   e.description,
      amount:        Number(e.amount),
      currency:      e.currency as "ARS" | "USD",
      category:      "general" as const,
      cardName:      e.cardName!,
      createdByName: userMap[e.createdById] ?? "?",
      createdAt:     e.createdAt.toISOString(),
    })),
    ...groceryExps.map((e) => ({
      id:            e.id,
      description:   e.description,
      amount:        Number(e.amount),
      currency:      e.currency as "ARS" | "USD",
      category:      "mercado" as const,
      cardName:      e.cardName!,
      createdByName: userMap[e.createdById] ?? "?",
      createdAt:     e.createdAt.toISOString(),
    })),
    ...personalExps.map((e) => ({
      id:            e.id,
      description:   e.concept,
      amount:        Number(e.amount),
      currency:      e.currency as "ARS" | "USD",
      category:      "personal" as const,
      cardName:      e.cardName!,
      createdByName: userMap[e.createdById] ?? "?",
      createdAt:     e.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Unique cards with expenses (for filter chips)
  const cardsWithExpenses = [...new Set(cardExpenses.map((e) => e.cardName))].sort();

  // Build tab URL helper
  function tabUrl(t: string) {
    const p = new URLSearchParams({ month, year: String(year), tab: t });
    return `/tdc?${p.toString()}`;
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          Tarjetas
        </h1>
        <Suspense fallback={
          <div className="h-8 w-36 rounded-xl animate-pulse" style={{ backgroundColor: "var(--bg-elevated)" }} />
        }>
          <MonthSelector month={month} year={year} />
        </Suspense>
      </div>

      {/* Tab bar */}
      <div
        className="flex rounded-xl p-1 gap-1"
        style={{ backgroundColor: "var(--bg-elevated)" }}
      >
        {[
          { key: "resumenes", label: "Resúmenes" },
          { key: "gastos",    label: "Gastos por tarjeta" },
        ].map(({ key, label }) => (
          <Link
            key={key}
            href={tabUrl(key)}
            className="flex-1 text-center py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: tab === key ? "var(--bg-card)" : "transparent",
              color:           tab === key ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      {tab === "resumenes" ? (
        <StatementsList
          statements={statementsData}
          month={month}
          year={year}
        />
      ) : (
        <CardExpenses
          expenses={cardExpenses}
          cards={cardsWithExpenses}
        />
      )}
    </div>
  );
}
