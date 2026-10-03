/**
 * Plan simple — préstamos y deudas (solo servidor).
 * Validación de datos y generación de las cuotas mensuales (PlanEntry con `loanId`).
 */

import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  addMonths, currentPeriod, isLoanFinished, loanDueDate, loanKind, loanState, monthlyRatePct, pastPaymentPlan,
  proposeLoanPayment, round2,
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
  // Una tasa anual (TNA) puede pasar el 100 %; una por mes o menos, no.
  const interestAnnual = !!interestRate && body.interestAnnual === true;
  if (interestRate != null && interestRate > (interestAnnual ? 2000 : 100)) throw new ApiError("Interés inválido");
  const interestTaxPct = !interestRate || body.interestTaxPct == null || body.interestTaxPct === ""
    ? null
    : v.amount(body.interestTaxPct, "IVA sobre el interés", { allowZero: true });
  if (interestTaxPct != null && interestTaxPct > 100) throw new ApiError("IVA sobre el interés inválido");

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
      interestFrequency: interestRate
        ? interestAnnual ? "MONTHLY" as const : v.oneOf(body.interestFrequency ?? "MONTHLY", FREQUENCIES, "Frecuencia del interés")
        : null,
      interestAnnual,
      interestTaxPct: interestTaxPct || null,
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

/**
 * Recalcula el interés de las cuotas pendientes después de cambiar cuotas anteriores, la tasa
 * o el saldo según el banco: el interés de cada mes sale del saldo que quedaba al empezarlo.
 * Las cuotas ya pagadas no se tocan.
 */
export async function rethreadInterest(tx: Tx, loan: LoanDTO): Promise<void> {
  let running: LoanDTO = { ...loan, payments: [] };
  for (const p of loan.payments) {
    let interest = p.interest;
    if (!p.isDone) {
      interest = round2(loanState(running, p.period).balance * monthlyRatePct(loan, p.period) / 100);
      if (Math.abs(interest - p.interest) > 0.005) {
        await tx.planEntry.update({ where: { id: p.entryId }, data: { interestAmount: interest || null } });
      }
    }
    running = { ...running, payments: [...running.payments, { ...p, interest }] };
  }
}

/**
 * Carga cuotas que ya estaban pagadas antes de que la app conociera el préstamo.
 * Las crea como pagadas en los meses anteriores a la primera cuota existente (o a `before`
 * si todavía no hay ninguna) y corre el inicio del préstamo si hace falta. Así el número
 * de cuota y el saldo quedan como en la realidad, sin tocar el mes en curso.
 * Devuelve cuántas cuotas cargó.
 */
export async function addPastPayments(
  tx: Tx,
  householdId: string,
  loanId: string,
  opts: { count: number; amount?: number; before?: string },
): Promise<number> {
  const [loan] = await loadLoans(householdId, { id: loanId }, tx);
  if (!loan) throw new ApiError("No encontrado", 404);
  if (loan.isClosed) throw new ApiError("Este préstamo ya está terminado");
  if (loan.mode === "OPEN") throw new ApiError("En una deuda sin cuotas, ajustá el saldo pendiente");

  const { periods, max } = pastPaymentPlan(loan, opts.count, opts.before ?? currentPeriod());
  if (max === 0) {
    throw new ApiError(loan.mode === "FIXED" ? "Ya están cargadas todas las cuotas" : "No hay cuotas anteriores para cargar");
  }
  if (loan.mode === "FIXED" && opts.count > max) {
    throw new ApiError(`Como mucho podés cargar ${max} ${max === 1 ? "cuota" : "cuotas"} más`);
  }
  if (periods.length === 0) return 0;
  if (periods[0] < addMonths(currentPeriod(), -120)) throw new ApiError("Son demasiados meses hacia atrás");

  const startPeriod = periods[0] < loan.startPeriod ? periods[0] : loan.startPeriod;
  if (startPeriod !== loan.startPeriod) {
    await tx.planLoan.update({ where: { id: loan.id }, data: { startPeriod } });
  }

  // Se calculan en orden, desde un préstamo "vacío", para que cada cuota tome su interés
  // sobre el saldo que había en ese momento. Después se insertan todas juntas.
  let running: LoanDTO = { ...loan, startPeriod, payments: [] };
  const fixedAmount = opts.amount ?? (loan.mode === "FIXED" ? loan.payments[0]?.amount : undefined);
  const rows = [];
  for (const period of periods) {
    const proposal = proposeLoanPayment(running, period);
    if (!proposal) continue;
    const amount = fixedAmount ?? proposal.amount;
    const due = loanDueDate(loan.dueDay, period);
    rows.push({
      householdId,
      period,
      kind: loanKind(loan.direction),
      loanId: loan.id,
      name: loan.name,
      categoryId: loan.categoryId,
      currency: loan.currency,
      amount,
      interestAmount: proposal.interest || null,
      date: due ? new Date(`${due}T00:00:00Z`) : null,
      isDone: true,
    });
    running = {
      ...running,
      payments: [...running.payments, { entryId: "", period, amount, interest: proposal.interest, isDone: true }],
    };
  }
  if (rows.length > 0) await tx.planEntry.createMany({ data: rows });
  const created = rows.length;

  await rethreadInterest(tx, { ...running, payments: [...running.payments, ...loan.payments] });
  await refreshLoanStatus(tx, householdId, loan.id);
  return created;
}

/**
 * Quita la cuota anterior más antigua (por si se cargó de más). Solo si está pagada y es de
 * un mes que no se usa en la app: las de meses iniciados se manejan desde ese mes.
 */
export async function removeOldestPastPayment(tx: Tx, householdId: string, loanId: string): Promise<void> {
  const [loan] = await loadLoans(householdId, { id: loanId }, tx);
  if (!loan) throw new ApiError("No encontrado", 404);
  const first = loan.payments[0];
  if (!first) throw new ApiError("No hay cuotas cargadas");
  const month = await tx.planMonth.findUnique({
    where: { householdId_period: { householdId, period: first.period } },
  });
  if (month || !first.isDone) {
    throw new ApiError("La cuota más antigua es de un mes que usás en la app: cambiala desde ese mes", 409);
  }

  await tx.planEntry.delete({ where: { id: first.entryId } });
  const rest = loan.payments.slice(1);
  if (loan.mode === "FIXED" && loan.startPeriod === first.period) {
    await tx.planLoan.update({ where: { id: loan.id }, data: { startPeriod: addMonths(first.period, 1) } });
  }
  await rethreadInterest(tx, { ...loan, payments: rest });
  await refreshLoanStatus(tx, householdId, loan.id);
}

/**
 * Guarda el saldo según el banco al empezar `period` (antes de la cuota de ese mes).
 * Desde ahí el saldo se calcula a partir de ese número; lo anterior deja de contar.
 */
export async function setLoanBalance(
  tx: Tx,
  householdId: string,
  loanId: string,
  period: string,
  amount: number,
): Promise<void> {
  const [loan] = await loadLoans(householdId, { id: loanId }, tx);
  if (!loan) throw new ApiError("No encontrado", 404);
  await tx.planLoanBalance.upsert({
    where: { loanId_period: { loanId, period } },
    create: { loanId, period, amount },
    update: { amount },
  });
  await afterBalanceChange(tx, householdId, loanId);
}

/** Quita un saldo según el banco: el saldo vuelve a salir de la cuenta anterior. */
export async function removeLoanBalance(tx: Tx, householdId: string, loanId: string, period: string): Promise<void> {
  const [loan] = await loadLoans(householdId, { id: loanId }, tx);
  if (!loan) throw new ApiError("No encontrado", 404);
  await tx.planLoanBalance.deleteMany({ where: { loanId, period } });
  await afterBalanceChange(tx, householdId, loanId);
}

async function afterBalanceChange(tx: Tx, householdId: string, loanId: string): Promise<void> {
  const [loan] = await loadLoans(householdId, { id: loanId }, tx);
  if (!loan) return;
  await rethreadInterest(tx, loan);
  await refreshLoanStatus(tx, householdId, loanId);
}
