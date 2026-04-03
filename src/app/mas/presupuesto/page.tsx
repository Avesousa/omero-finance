import { prisma } from "@/lib/prisma";
import { HOUSEHOLD_ID } from "../../../../prisma/constants";
import { MONTH_NAMES, type MonthName } from "@/lib/months";
import { BudgetConfigEditor } from "@/components/budget/budget-config-editor";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PresupuestoPage() {
  const now   = new Date();
  const month = MONTH_NAMES[now.getMonth()] as MonthName;
  const year  = now.getFullYear();

  const incomeAgg = await prisma.income.aggregate({
    where: { householdId: HOUSEHOLD_ID, month, year },
    _sum: { amountArs: true },
  });
  const totalIncome = Number(incomeAgg._sum.amountArs ?? 0);

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
          Presupuesto mensual
        </h1>
      </div>

      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Definí cómo distribuir el ingreso del mes. Usá % o montos fijos; Gastos libres puede quedar en automático.
      </p>

      <BudgetConfigEditor
        initialMonth={month}
        initialYear={year}
        totalIncome={totalIncome}
      />
    </div>
  );
}
