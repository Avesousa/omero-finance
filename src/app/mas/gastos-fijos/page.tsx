import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";
import { FixedExpenseManager } from "@/components/budget/fixed-expense-manager";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

export default async function GastosFijosPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { householdId } = session.user;

  const now   = new Date();
  const month = MONTH_NAMES[now.getMonth()];
  const year  = now.getFullYear();

  const [templates, existingCount] = await Promise.all([
    prisma.fixedExpenseTemplate.findMany({
      where: { householdId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.fixedExpense.count({
      where: { householdId, month, year },
    }),
  ]);

  const initial = templates.map((t) => ({
    id:       t.id,
    concept:  t.concept,
    currency: t.currency as "ARS" | "USD",
    amount:   Number(t.amount),
    isActive: t.isActive,
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
          Gastos fijos
        </h1>
      </div>

      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Configurá los gastos recurrentes (alquiler, expensas, servicios…). Los activos se suman automáticamente en el presupuesto.
      </p>

      <FixedExpenseManager
        initial={initial}
        month={month}
        year={year}
        hasExistingExpenses={existingCount > 0}
      />
    </div>
  );
}
