import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { IngresosClient } from "@/components/income/ingresos-client";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

export default async function IngresosPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { householdId } = session.user;

  const now   = new Date();
  const month = MONTH_NAMES[now.getMonth()];
  const year  = now.getFullYear();

  const incomes = await prisma.income.findMany({
    where: { householdId, month, year },
    orderBy: { createdAt: "desc" },
  });

  const initialIncomes = incomes.map((i) => ({
    id:                 i.id,
    type:               i.type as string,
    currency:           i.currency as "ARS" | "USD",
    amount:             Number(i.amount),
    amountArs:          i.amountArs != null ? Number(i.amountArs) : null,
    dollarRateSnapshot: i.dollarRateSnapshot != null ? Number(i.dollarRateSnapshot) : null,
    description:        i.description ?? null,
    isPersonal:         i.isPersonal,
    month:              i.month,
    year:               i.year,
    createdById:        i.createdById,
    createdAt:          i.createdAt.toISOString(),
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
          Ingresos
        </h1>
      </div>

      <IngresosClient
        initialIncomes={initialIncomes}
        initialMonth={month}
        initialYear={year}
      />
    </div>
  );
}
