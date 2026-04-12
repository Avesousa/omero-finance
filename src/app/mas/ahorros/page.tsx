import { prisma } from "@/lib/prisma";
import { HOUSEHOLD_ID } from "../../../../prisma/constants";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AhorrosClient } from "@/components/savings/ahorros-client";

export const dynamic = "force-dynamic";

export default async function AhorrosPage() {
  const currentYear = new Date().getFullYear();

  const savings = await prisma.saving.findMany({
    where: {
      householdId: HOUSEHOLD_ID,
      date: {
        gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
        lt:  new Date(`${currentYear + 1}-01-01T00:00:00.000Z`),
      },
    },
    orderBy: { date: "desc" },
  });

  const initial = savings.map((s) => ({
    id:                 s.id,
    date:               s.date.toISOString(),
    description:        s.description,
    type:               s.type as "AHORRO" | "VIAJE" | "INVERSION",
    currency:           s.currency as "ARS" | "USD",
    amount:             Number(s.amount),
    amountArs:          s.amountArs != null ? Number(s.amountArs) : null,
    dollarRateSnapshot: s.dollarRateSnapshot != null ? Number(s.dollarRateSnapshot) : null,
    platform:           s.platform ?? null,
    createdAt:          s.createdAt.toISOString(),
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
          Ahorros
        </h1>
      </div>

      <AhorrosClient initial={initial} currentYear={currentYear} />
    </div>
  );
}
