/**
 * Plan simple — préstamos y deudas (solo servidor).
 * Validación de datos y generación de las cuotas mensuales (PlanEntry con `loanId`).
 */

import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  isLoanFinished, loanDueDate, loanKind, proposeLoanPayment, round2,
  type LoanDTO, type LoanDirection, type LoanMode,
} from "./core";
import { ApiError, FREQUENCIES, categoryIdOrNull, loadLoans, v } from "./server";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export const LOAN_DIRECTIONS = ["OWE", "OWED"] as const;
export const LOAN_MODES = ["FIXED", "SCHEDULE", "OPEN"] as const;

/** Categoría por defecto: la que crea Plan simple para cada dirección. */
const DEFAULT_CATEGORY: Record<LoanDirection, string> = {
  OWE: "Deudas y préstamos",
  OWED: "Cobro de deudas",
};

/**
 * Valida el cuerpo de un préstamo. Al editar (`existing`) no cambian dirección,
 * modalidad ni moneda, y el primer mes solo se puede mover si no tiene cuotas generadas.
 */
export async function loanFields(householdId: string, body: Record<string, unknown>, existing?: LoanDTO) {
  const direction: LoanDirection = existing?.direction ?? v.oneOf(body.direction, LOAN_DIRECTIONS, "Tipo");
  const mode: LoanMode = existing?.mode ?? v.oneOf(body.mode, LOAN_MODES, "Modalidad");
  const kind = loanKind(direction);

  let categoryId: string | null;
  if (body.categoryId !== undefined) {
    categoryId = await categoryIdOrNull(householdId, body.categoryId, kind);
  } else if (existing) {
    categoryId = existing.categoryId;
  } else {
    const cat = await prisma.planCategory.findFirst({
      where: { householdId, kind, name: DEFAULT_CATEGORY[direction], isArchived: false },
    });
    categoryId = cat?.id ?? null;
  }

  const startPeriod = existing && existing.payments.length > 0
    ? existing.startPeriod
    : v.nearPeriod(body.startPeriod ?? existing?.startPeriod);

  const interestRate = body.interestRate == null || body.interestRate === ""
    ? null
    : v.amount(body.interestRate, "Interés", { allowZero: true });
  if (interestRate != null && interestRate > 100) throw new ApiError("Interés inválido");

  let principal: number;
  let installments: number | null = null;
  let installmentAmount: number | null = null;
  let schedule: { period: string; amount: number }[] = [];
  let endDate: Date | null = null;

  if (mode === "FIXED") {
    principal = v.amount(body.principal, "Monto del préstamo");
    installments = v.int(body.installments, "Cuotas", 1, 360);
    installmentAmount = v.optionalAmount(body.installmentAmount, "Cuota");
    if (installmentAmount === 0) installmentAmount = null;
  } else if (mode === "OPEN") {
    principal = v.amount(body.principal, "Saldo");
    installmentAmount = v.amount(body.installmentAmount, "Pago por mes");
    endDate = v.optionalDate(body.endDate);
  } else {
    if (!Array.isArray(body.schedule) || body.schedule.length === 0) {
      throw new ApiError("Cargá al menos una cuota");
    }
    if (body.schedule.length > 360) throw new ApiError("Demasiadas cuotas");
    const seen = new Set<string>();
    schedule = body.schedule.map((raw: unknown) => {
      const item = (raw ?? {}) as Record<string, unknown>;
      const period = v.nearPeriod(item.period);
      if (seen.has(period)) throw new ApiError("Hay dos cuotas en el mismo mes");
      seen.add(period);
      return { period, amount: v.amount(item.amount, "Cuota") };
    }).sort((a, b) => a.period.localeCompare(b.period));
    principal = round2(schedule.reduce((s, x) => s + x.amount, 0));
  }

  return {
    data: {
      direction,
      mode,
      name: v.text(body.name ?? existing?.name, "El nombre"),
      counterpart: body.counterpart !== undefined ? v.optionalText(body.counterpart, 60) : existing?.counterpart ?? null,
      categoryId,
      currency: existing?.currency ?? v.currency(body.currency),
      principal,
      installments,
      installmentAmount,
      interestRate: interestRate || null,
      interestFrequency: interestRate ? v.oneOf(body.interestFrequency ?? "MONTHLY", FREQUENCIES, "Frecuencia del interés") : null,
      startPeriod,
      dueDay: v.optionalInt(body.dueDay, "Día de vencimiento", 1, 31),
      endDate,
      note: body.note !== undefined ? v.optionalText(body.note) : existing?.note ?? null,
    },
    schedule,
  };
}

/**
 * Crea la cuota de `period` (si corresponde y no existe) y devuelve el préstamo
 * con esa cuota sumada. `amount` pisa la cuota propuesta.
 */
export async function createLoanEntry(
  tx: Tx,
  householdId: string,
  loan: LoanDTO,
  period: string,
  amount?: number,
): Promise<LoanDTO> {
  if (loan.payments.some((p) => p.period === period)) return loan;
  const proposal = proposeLoanPayment(loan, period);
  if (!proposal) return loan;
  const finalAmount = amount ?? proposal.amount;
  const due = loanDueDate(loan.dueDay, period);
  const entry = await tx.planEntry.create({
    data: {
      householdId,
      period,
      kind: loanKind(loan.direction),
      loanId: loan.id,
      name: loan.name,
      categoryId: loan.categoryId,
      currency: loan.currency,
      amount: finalAmount,
      interestAmount: proposal.interest || null,
      date: due ? new Date(`${due}T00:00:00Z`) : null,
    },
  });
  return {
    ...loan,
    payments: [
      ...loan.payments,
      { entryId: entry.id, period, amount: finalAmount, interest: proposal.interest, isDone: false },
    ].sort((a, b) => a.period.localeCompare(b.period)),
  };
}

/** Genera las cuotas que faltan en los meses ya iniciados (por ejemplo, al crear un préstamo). */
export async function fillStartedMonths(tx: Tx, householdId: string, loanId: string): Promise<void> {
  let [loan] = await loadLoans(householdId, { id: loanId }, tx);
  if (!loan) return;
  const months = await tx.planMonth.findMany({
    where: { householdId, period: { gte: loan.startPeriod } },
    orderBy: { period: "asc" },
  });
  for (const m of months) loan = await createLoanEntry(tx, householdId, loan, m.period);
}

/** Cierra el préstamo si quedó saldado, o lo reabre si se destildó una cuota. */
export async function refreshLoanStatus(tx: Tx, householdId: string, loanId: string): Promise<void> {
  const [loan] = await loadLoans(householdId, { id: loanId }, tx);
  if (!loan) return;
  const finished = isLoanFinished(loan);
  if (finished !== loan.isClosed) {
    await tx.planLoan.update({
      where: { id: loan.id },
      data: { isClosed: finished, closedAt: finished ? new Date() : null },
    });
  }
}
