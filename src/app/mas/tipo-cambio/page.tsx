import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";
import { TipoCambioClient } from "@/components/settings/tipo-cambio-client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TipoCambioPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { householdId } = session.user;

  const rates = await prisma.exchangeRate.findMany({
    where: { OR: [{ householdId }, { householdId: null }] },
    orderBy: { date: "desc" },
    take: 10,
  });

  const initialRates = rates.map((r) => ({
    id:     r.id,
    date:   r.date.toISOString(),
    usdArs: Number(r.usdArs),
    source: r.source as "API" | "MANUAL",
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
          Tipo de cambio
        </h1>
      </div>

      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Configurá el tipo de cambio USD/ARS manualmente. El valor que ingreses se usará para convertir gastos en dólares.
      </p>

      <TipoCambioClient initialRates={initialRates} />
    </div>
  );
}
