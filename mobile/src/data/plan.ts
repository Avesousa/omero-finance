import {
  buildLoanProposal,
  buildProposal,
  buildSummary,
  planDailyAllowance,
  type EntryDTO,
  type MonthPlan,
} from "../domain/index.ts";
import { dailyAllowance } from "./selectors.ts";
import type { HomeDefinitions, HomeExtras, HomeSummary } from "./types";

/** Cuántas categorías se muestran sueltas en "En qué se va el mes"; el resto se junta en "Otros". */
const SPENDING_SLICES = 5;

/**
 * El plan listo para planificar: si el mes todavía no empezó, le suma las entries que la web propone al
 * iniciarlo (fijos de ingreso y gasto, y cuotas de préstamos), como entries sintéticas `proj-…` sin pagar.
 * Un mes iniciado vuelve igual. Es idempotente: no repite un fijo o una cuota que ya tenga entry en el mes.
 */
export function projectedPlan(plan: MonthPlan): MonthPlan {
  if (plan.started) return plan;
  const inPeriod = plan.entries.filter((e) => e.period === plan.period);
  const hasRecurring = new Set(inPeriod.map((e) => e.recurringId).filter(Boolean));
  const hasLoan = new Set(inPeriod.map((e) => e.loanId).filter(Boolean));
  const base = { period: plan.period, targetCategoryId: null, date: null, isDone: false, note: null } as const;

  const fixed: EntryDTO[] = buildProposal(plan.recurrings, plan.period)
    .filter((r) => !hasRecurring.has(r.recurringId))
    .map((r) => ({
      ...base,
      id: `proj-rec-${r.recurringId}`,
      kind: r.kind,
      recurringId: r.recurringId,
      name: r.name,
      categoryId: r.categoryId,
      currency: r.currency,
      amount: r.amount,
      loanId: null,
      interestAmount: null,
    }));
  const installments: EntryDTO[] = buildLoanProposal(plan.loans, plan.period)
    .filter((r) => !hasLoan.has(r.loanId))
    .map((r) => ({
      ...base,
      id: `proj-loan-${r.loanId}`,
      kind: r.kind,
      recurringId: null,
      name: r.name,
      categoryId: plan.loans.find((l) => l.id === r.loanId)?.categoryId ?? null,
      currency: r.currency,
      amount: r.amount,
      loanId: r.loanId,
      interestAmount: r.interest,
    }));
  return { ...plan, entries: [...plan.entries, ...fixed, ...installments] };
}

/**
 * Definiciones de Inicio (única fuente; ninguna pantalla las recalcula):
 * - `balance` = lo que tenés hoy (`summary.availableArs`).
 * - `perDay` = gasto diario = libre ÷ días que quedan (`dailyAllowance`).
 * - `freeMonth` = libre del mes (`summary.freeArs`).
 * - `monthIncome` = ingresos del mes; `monthExpenses` = lo que ya salió (`summary.paidArs`).
 */
export function homeDefinitions(h: Pick<HomeSummary, "balance" | "free" | "daysLeft" | "monthIncome" | "monthExpenses">): HomeDefinitions {
  return {
    balance: h.balance,
    perDay: dailyAllowance(h.free, h.daysLeft),
    freeMonth: h.free,
    monthIncome: h.monthIncome,
    monthExpenses: h.monthExpenses,
  };
}

/**
 * Inicio derivado del plan del mes (`buildSummary`, la misma cuenta que la web). Lo que no sale del plan
 * (saludo, pagos de Apple Pay, historia del nido) llega en `extras`.
 * - `fixed` cuenta los gastos fijos del mes (con `recurringId`): pagados x de y y sus montos.
 * - `daysLeft` cuenta hoy (28 el 3 de noviembre); en un mes pasado es 0.
 */
export function homeFromPlan(source: MonthPlan, extras: HomeExtras): HomeSummary {
  const plan = projectedPlan(source);
  const s = buildSummary(plan);
  const allowance = planDailyAllowance(s.freeArs, plan.period, plan.today);

  const fixedEntries = plan.entries.filter((e) => e.period === plan.period && e.kind === "EXPENSE" && e.recurringId);

  const spent = s.rows
    .filter((r) => r.actual > 0.5)
    .map((r) => ({ id: r.categoryId ?? "uncategorized", name: r.name, amount: r.actual }))
    .sort((a, b) => b.amount - a.amount);
  const head = spent.length > SPENDING_SLICES ? spent.slice(0, SPENDING_SLICES - 1) : spent;
  const rest = spent.slice(head.length);
  const spendingByCategory: HomeSummary["spendingByCategory"] = [
    ...head,
    ...(rest.length > 0
      ? [{ id: "other", labelKey: "spending.categories.other", amount: rest.reduce((sum, r) => sum + r.amount, 0) }]
      : []),
  ];

  return {
    greetingName: extras.greetingName,
    period: plan.period,
    today: plan.today,
    daysLeft: allowance?.daysLeft ?? 0,
    income: s.incomeArs,
    balance: s.availableArs,
    monthIncome: s.incomeArs,
    monthExpenses: s.paidArs,
    available: s.availableArs,
    free: s.freeArs,
    pendingToPay: s.pendingArs,
    spendingByCategory,
    fixed: {
      paid: fixedEntries.filter((e) => e.isDone).length,
      total: fixedEntries.length,
      paidAmount: s.fixedPaidArs,
      totalAmount: s.fixedArs,
    },
    pendingConfirmCount: extras.pendingConfirmCount,
    story: extras.story,
  };
}
