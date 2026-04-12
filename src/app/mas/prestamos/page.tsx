import { prisma } from "@/lib/prisma";
import { HOUSEHOLD_ID } from "../../../../prisma/constants";
import { PrestamosClient } from "@/components/loans/prestamos-client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PrestamosPage() {
  const [loansRaw, debtsRaw] = await Promise.all([
    prisma.loan.findMany({
      where: { householdId: HOUSEHOLD_ID },
      include: { installmentRecords: { orderBy: { installmentNumber: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.debt.findMany({
      where: { householdId: HOUSEHOLD_ID },
      orderBy: { date: "desc" },
    }),
  ]);

  const loans = loansRaw.map((loan) => ({
    id:                 loan.id,
    direction:          loan.direction as "DADO" | "TOMADO",
    counterpart:        loan.counterpart,
    paymentMethod:      loan.paymentMethod ?? null,
    currency:           loan.currency as "ARS" | "USD",
    principal:          Number(loan.principal),
    principalArs:       loan.principalArs ? Number(loan.principalArs) : null,
    dollarRateSnapshot: loan.dollarRateSnapshot ? Number(loan.dollarRateSnapshot) : null,
    installments:       loan.installments,
    installmentUnit:    loan.installmentUnit as "WEEKLY" | "MONTHLY",
    interestRate:       Number(loan.interestRate),
    totalAmount:        Number(loan.totalAmount),
    notes:              loan.notes ?? null,
    createdAt:          loan.createdAt.toISOString(),
    installmentRecords: loan.installmentRecords.map((inst) => ({
      id:                inst.id,
      loanId:            inst.loanId,
      installmentNumber: inst.installmentNumber,
      dueDate:           inst.dueDate.toISOString(),
      amount:            Number(inst.amount),
      currency:          inst.currency as "ARS" | "USD",
      isPaid:            inst.isPaid,
      paidDate:          inst.paidDate ? inst.paidDate.toISOString() : null,
    })),
  }));

  const debts = debtsRaw.map((debt) => ({
    id:                 debt.id,
    date:               debt.date.toISOString(),
    concept:            debt.concept,
    debtor:             debt.debtor,
    currency:           debt.currency as "ARS" | "USD",
    totalAmount:        Number(debt.totalAmount),
    totalArs:           debt.totalArs ? Number(debt.totalArs) : null,
    dollarRateSnapshot: debt.dollarRateSnapshot ? Number(debt.dollarRateSnapshot) : null,
    amountPaid:         Number(debt.amountPaid),
    status:             debt.status as "ACTIVE" | "SETTLED",
    createdAt:          debt.createdAt.toISOString(),
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
          Préstamos y deudas
        </h1>
      </div>

      <PrestamosClient initialLoans={loans} initialDebts={debts} />
    </div>
  );
}
