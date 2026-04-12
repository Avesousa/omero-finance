export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";
import { MONTH_NAMES, type MonthName } from "@/lib/months";
import { MovimientosList } from "@/components/movimientos/movimientos-list";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string; cat?: string }>;
}

export type Movimiento = {
  id:          string;
  date:        string;
  description: string;
  amount:      number;
  currency:    "ARS" | "USD";
  amountArs:   number | null;
  category:    "mercado" | "general" | "fijo" | "personal" | "ingreso";
  createdBy:   string;
};

export default async function MovimientosPage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { householdId } = session.user;
  const params = await searchParams;
  const now    = new Date();

  const month = (
    params.month && MONTH_NAMES.includes(params.month as MonthName)
      ? params.month
      : MONTH_NAMES[now.getMonth()]
  ) as MonthName;
  const year = params.year ? parseInt(params.year, 10) : now.getFullYear();

  const users = await prisma.user.findMany({
    where: { householdId },
    select: { id: true, name: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  const [groceries, household, fixed, personal, incomes] = await Promise.all([
    prisma.groceryExpense.findMany({ where: { householdId, month, year }, orderBy: { createdAt: "desc" } }),
    prisma.householdExpense.findMany({ where: { householdId, month, year }, orderBy: { createdAt: "desc" } }),
    prisma.fixedExpense.findMany({ where: { householdId, month, year }, orderBy: { createdAt: "desc" } }),
    prisma.personalExpense.findMany({ where: { householdId, month, year }, orderBy: { createdAt: "desc" } }),
    prisma.income.findMany({ where: { householdId, month, year }, orderBy: { createdAt: "desc" } }),
  ]);

  const movimientos: Movimiento[] = [
    ...groceries.map((e) => ({ id: e.id, date: e.createdAt.toISOString(), description: e.description, amount: Number(e.amount), currency: e.currency as "ARS" | "USD", amountArs: e.amountArs ? Number(e.amountArs) : null, category: "mercado" as const, createdBy: userMap[e.createdById] ?? "?" })),
    ...household.map((e) => ({ id: e.id, date: e.createdAt.toISOString(), description: e.description, amount: Number(e.amount), currency: e.currency as "ARS" | "USD", amountArs: e.amountArs ? Number(e.amountArs) : null, category: "general" as const, createdBy: userMap[e.createdById] ?? "?" })),
    ...fixed.map((e) => ({ id: e.id, date: e.createdAt.toISOString(), description: e.concept, amount: Number(e.amount), currency: e.currency as "ARS" | "USD", amountArs: e.amountArs ? Number(e.amountArs) : null, category: "fijo" as const, createdBy: userMap[e.createdById] ?? "?" })),
    ...personal.map((e) => ({ id: e.id, date: e.createdAt.toISOString(), description: e.concept, amount: Number(e.amount), currency: e.currency as "ARS" | "USD", amountArs: e.amountArs ? Number(e.amountArs) : null, category: "personal" as const, createdBy: userMap[e.createdById] ?? "?" })),
    ...incomes.map((e) => ({ id: e.id, date: e.createdAt.toISOString(), description: e.description ?? e.type, amount: Number(e.amount), currency: e.currency as "ARS" | "USD", amountArs: e.amountArs ? Number(e.amountArs) : null, category: "ingreso" as const, createdBy: userMap[e.createdById] ?? "?" })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="flex flex-col gap-4 px-4 py-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="w-8 h-8 flex items-center justify-center rounded-xl"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
        >
          <ChevronLeft size={16} />
        </Link>
        <div>
          <h1 className="text-base font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
            Movimientos
          </h1>
          <p className="text-xs capitalize" style={{ color: "var(--text-secondary)" }}>
            {month} {year}
          </p>
        </div>
      </div>

      <MovimientosList movimientos={movimientos} month={month} year={year} />
    </div>
  );
}
