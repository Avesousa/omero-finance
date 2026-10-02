import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";
import { GastosPropiosClient } from "@/components/personal/gastos-propios-client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

export default async function GastosPropiosPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { householdId } = session.user;
  const now   = new Date();
  const month = MONTH_NAMES[now.getMonth()];
  const year  = now.getFullYear();

  const [expensesRaw, usersRaw] = await Promise.all([
    prisma.personalExpense.findMany({
      where: { householdId, month, year },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { householdId },
    }),
  ]);

  const expenses = expensesRaw.map((e) => ({
    id:                 e.id,
    userId:             e.userId,
    concept:            e.concept,
    cardName:           e.cardName ?? null,
    currency:           e.currency as "ARS" | "USD",
    amount:             Number(e.amount),
    amountArs:          e.amountArs ? Number(e.amountArs) : null,
    isPaid:             e.isPaid,
    month:              e.month,
    year:               e.year,
    createdAt:          e.createdAt.toISOString(),
  }));

  const users = usersRaw.map((u) => ({
    id:          u.id,
    name:        u.name,
    avatarColor: u.avatarColor,
  }));

  return (
    <div className="flex flex-col gap-5 px-4 py-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <Link
          href="/mas"
          className="w-8 h-8 flex items-center justify-center rounded-xl"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
        >
          <ChevronLeft size={16} />
        </Link>
        <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          Gastos propios
        </h1>
      </div>

      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Gastos personales de cada integrante del hogar (ropa, salidas, gustos…).
      </p>

      <GastosPropiosClient
        initialExpenses={expenses}
        users={users}
        currentUserId={session.user.id}
        initialMonth={month}
        initialYear={year}
      />
    </div>
  );
}
