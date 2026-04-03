import { prisma } from "@/lib/prisma";
import { HOUSEHOLD_ID } from "../../../../prisma/constants";
import { AccountManager, type AccountItem } from "@/components/accounts/account-manager";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CuentasPage() {
  const accounts = await prisma.account.findMany({
    where: { householdId: HOUSEHOLD_ID },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, avatarColor: true } } },
  });

  const initial: AccountItem[] = accounts.map((a) => ({
    id:        a.id,
    name:      a.name,
    type:      a.type as AccountItem["type"],
    currency:  a.currency as "ARS" | "USD",
    balance:   Number(a.balance),
    isDefault: a.isDefault,
    userId:    a.userId,
    user:      a.user,
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
          Cuentas
        </h1>
      </div>

      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Registrá tus cuentas con su saldo actual y hacé transferencias entre ellas para saber dónde está el dinero.
      </p>

      <AccountManager initial={initial} />
    </div>
  );
}
