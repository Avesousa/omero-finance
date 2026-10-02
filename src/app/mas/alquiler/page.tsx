import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AlquilerClient } from "@/components/rent/alquiler-client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

export default async function AlquilerPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { householdId } = session.user;
  const now   = new Date();
  const month = MONTH_NAMES[now.getMonth()];
  const year  = now.getFullYear();

  const payments = await prisma.rentPayment.findMany({
    where: { householdId, month, year },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });

  const initial = payments.map((p) => ({
    id:          p.id,
    type:        p.type as "ALQUILER" | "EXPENSAS" | "TRABAJOS",
    apartment:   p.apartment,
    currency:    p.currency as "ARS" | "USD",
    amount:      Number(p.amount),
    amountArs:   p.amountArs ? Number(p.amountArs) : null,
    description: p.description,
    cbuAlias:    p.cbuAlias,
    month:       p.month,
    year:        p.year,
  }));

  return (
    <div className="flex flex-col gap-5 px-4 py-4 max-w-lg mx-auto pb-32">
      <div className="flex items-center gap-2">
        <Link
          href="/mas"
          className="w-8 h-8 flex items-center justify-center rounded-xl"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
        >
          <ChevronLeft size={16} />
        </Link>
        <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          Alquiler y expensas
        </h1>
      </div>

      <AlquilerClient
        initialPayments={initial}
        initialMonth={month}
        initialYear={year}
      />
    </div>
  );
}
