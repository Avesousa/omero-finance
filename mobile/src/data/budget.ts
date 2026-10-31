import {
  buildSummary,
  cardLines,
  normalizeText,
  TDC_KEY,
  type BudgetRow,
  type MonthPlan,
} from "../domain/index.ts";
import { projectedPlan } from "./plan.ts";
import type { AppNotice, AssistantTarget, BudgetGroup, BudgetItem, BudgetLine, BudgetView, SuggestedBudget } from "./types";

/** Nombre de la categoría de ahorro del hogar (se compara sin acentos ni mayúsculas). */
export const SAVINGS_CATEGORY_NAME = "Ahorro e inversión";

const isSavingsName = (name: string): boolean => normalizeText(name) === normalizeText(SAVINGS_CATEGORY_NAME);

const emptyRow = (categoryId: string, name: string): BudgetRow => ({
  categoryId,
  name,
  isCards: false,
  budget: 0,
  actual: 0,
  paid: 0,
  pending: 0,
  earmarked: 0,
  remaining: 0,
  status: "unused",
});

/**
 * Presupuesto del mes listo para mostrar: el mismo método que la web (`buildSummary`: tope por categoría
 * y por mes; el Libre descuenta de cada una lo que falta gastar del tope o lo que falta pagar).
 * - savings: la categoría de ahorro, arriba de todo.
 * - committed: categorías cuyo gasto viene de fijos, cuotas de préstamos o tarjetas ("sale solo").
 * - variable: el resto con tope o con gasto.
 */
export function budgetView(source: MonthPlan): BudgetView {
  const plan = projectedPlan(source);
  const summary = buildSummary(plan);
  const expenses = plan.entries.filter((e) => e.period === plan.period && e.kind === "EXPENSE");

  // Fijos y cuotas por categoría: cuántos hay y cuántos ya se pagaron.
  const fixedBy = new Map<string, { paid: number; total: number }>();
  for (const e of expenses) {
    if (!(e.recurringId || e.loanId) || !e.categoryId) continue;
    const cur = fixedBy.get(e.categoryId) ?? { paid: 0, total: 0 };
    cur.total += 1;
    if (e.isDone) cur.paid += 1;
    fixedBy.set(e.categoryId, cur);
  }
  const cards = cardLines(plan.cards, plan.statements, plan.purchases, plan.period, plan.usdRate);
  const cardsFixed = { paid: cards.filter((l) => l.isPaid).length, total: cards.length };

  const expenseCats = plan.categories.filter((c) => c.kind === "EXPENSE" && !c.isArchived);
  const savingsCat = expenseCats.find((c) => isSavingsName(c.name)) ?? null;
  const tdcIds = new Set(expenseCats.filter((c) => c.systemKey === TDC_KEY).map((c) => c.id));

  const toLine = (row: BudgetRow, group: BudgetGroup): BudgetLine => ({
    ...row,
    group,
    ratio: row.budget > 0 ? row.actual / row.budget : 0,
    fixed:
      group !== "committed" || row.categoryId === null ? null
      : tdcIds.has(row.categoryId) ? cardsFixed
      : fixedBy.get(row.categoryId) ?? { paid: 0, total: 0 },
  });

  let savings: BudgetLine | null = null;
  const committed: BudgetLine[] = [];
  const variable: BudgetLine[] = [];
  for (const row of summary.rows) {
    const id = row.categoryId;
    if (id !== null && id === savingsCat?.id) savings = toLine(row, "savings");
    else if (id !== null && (row.isCards || tdcIds.has(id) || fixedBy.has(id))) committed.push(toLine(row, "committed"));
    else variable.push(toLine(row, "variable"));
  }
  if (!savings && savingsCat) savings = toLine(emptyRow(savingsCat.id, savingsCat.name), "savings");

  const listed = new Set([...committed, ...variable].map((l) => l.categoryId));
  const budgeted = new Set(plan.budgets.filter((b) => b.amount > 0).map((b) => b.categoryId));
  const withoutBudget = expenseCats
    .filter((c) => c.id !== savingsCat?.id && !tdcIds.has(c.id) && !fixedBy.has(c.id) && !budgeted.has(c.id) && !listed.has(c.id))
    .map((c) => ({ categoryId: c.id, name: c.name }));

  const watched = [...committed, ...variable];
  return {
    projected: !source.started,
    summary,
    free: summary.freeArs,
    income: summary.incomeArs,
    assigned: summary.budgetTotalArs,
    savings,
    committed,
    variable,
    withoutBudget,
    canCopyPrevious: plan.previousBudgets.length > 0 && plan.budgets.length === 0,
    previousPeriod: plan.previousBudgetPeriod,
    counts: {
      near: watched.filter((l) => l.status === "near").length,
      over: watched.filter((l) => l.status === "over").length,
    },
    variableTotals: {
      budget: variable.reduce((sum, l) => sum + l.budget, 0),
      actual: variable.reduce((sum, l) => sum + l.actual, 0),
    },
  };
}

/** Para el asistente: tope del mes anterior (null si no había) y lo gastado hasta ahora en la categoría. */
export function suggestedBudget(plan: MonthPlan, categoryId: string): SuggestedBudget {
  const previous = plan.previousBudgets.find((b) => b.categoryId === categoryId)?.amount ?? null;
  const spentNow = buildSummary(projectedPlan(plan)).rows.find((r) => r.categoryId === categoryId)?.actual ?? 0;
  return { previous, spentNow };
}

/** Las líneas para copiar el presupuesto anterior al mes. */
export function previousBudgetItems(plan: MonthPlan): BudgetItem[] {
  return plan.previousBudgets.filter((b) => b.amount > 0).map((b) => ({ categoryId: b.categoryId, amount: b.amount }));
}

/** Avisos de categorías cerca del tope o pasadas (no incluye el ahorro). Los ids son estables por categoría. */
export function budgetNotices(view: BudgetView, today: string): AppNotice[] {
  const at = `${today}T08:00`;
  const out: AppNotice[] = [];
  for (const l of [...view.variable, ...view.committed]) {
    if (l.status !== "near" && l.status !== "over") continue;
    out.push({
      id: `budget-${l.status}-${l.categoryId ?? "none"}`,
      kind: l.status === "over" ? "budgetOverCategory" : "budgetNear",
      params: { name: l.name },
      at,
      read: false,
    });
  }
  return out;
}

/** El plan con las líneas de presupuesto aplicadas (monto 0 quita la línea), igual que `PUT /api/plan/budget`. No muta el original. */
export function withBudgetItems(plan: MonthPlan, items: readonly BudgetItem[]): MonthPlan {
  const budgets = plan.budgets.map((b) => ({ ...b }));
  for (const item of items) {
    const i = budgets.findIndex((b) => b.categoryId === item.categoryId);
    if (item.amount > 0) {
      if (i >= 0) budgets[i].amount = item.amount;
      else budgets.push({ categoryId: item.categoryId, amount: item.amount });
    } else if (i >= 0) {
      budgets.splice(i, 1);
    }
  }
  return { ...plan, budgets };
}

/** Libre del mes si se guardaran estas líneas (para mostrar "Sin asignar" antes de confirmar). */
export function projectedFree(plan: MonthPlan, items: readonly BudgetItem[]): number {
  return budgetView(withBudgetItems(plan, items)).free;
}

/**
 * Lo que recorre el asistente: primero el ahorro; después las categorías variables con tope el mes anterior,
 * con tope este mes o con gasto (`steps`). Las demás categorías editables van como "agregar otra" (`extras`).
 * Lo comprometido (fijos, cuotas, tarjetas) no se pregunta: sale solo.
 */
export function assistantTargets(plan: MonthPlan): { steps: AssistantTarget[]; extras: AssistantTarget[] } {
  const view = budgetView(plan);
  const previousOf = (id: string) => {
    const amount = plan.previousBudgets.find((b) => b.categoryId === id)?.amount ?? 0;
    return amount > 0 ? amount : null;
  };
  const toTarget = (categoryId: string, name: string, kind: AssistantTarget["kind"], line: BudgetRow | null): AssistantTarget => ({
    categoryId,
    name,
    kind,
    previous: previousOf(categoryId),
    spentNow: line?.actual ?? 0,
    current: line?.budget ?? 0,
  });

  const steps: AssistantTarget[] = [];
  if (view.savings && view.savings.categoryId) steps.push(toTarget(view.savings.categoryId, view.savings.name, "savings", view.savings));
  const candidates: AssistantTarget[] = [
    ...view.variable.filter((l) => l.categoryId !== null).map((l) => toTarget(l.categoryId as string, l.name, "category", l)),
    ...view.withoutBudget.map((c) => toTarget(c.categoryId, c.name, "category", null)),
  ];
  const extras: AssistantTarget[] = [];
  for (const c of candidates) {
    if (c.previous !== null || c.spentNow > 0 || c.current > 0) steps.push(c);
    else extras.push(c);
  }
  return { steps, extras };
}
