import { daysInPeriod, loanDueDate, occurrencesInPeriod, round2, toArs, type MonthPlan } from "../domain/index.ts";
import { projectedPlan } from "./plan.ts";
import type { FixedExpensesView, FixedGroup, FixedItem } from "./types";

const DAY_MS = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Fecha de una regla semanal: la próxima vez que cae ese día desde `today` dentro del mes; si ya pasaron todas, la última. */
function weeklyDate(weekday: number, period: string, today: string): string | null {
  const days = daysInPeriod(period);
  let last: string | null = null;
  for (let d = 1; d <= days; d++) {
    const iso = `${period}-${String(d).padStart(2, "0")}`;
    if (new Date(utc(iso)).getUTCDay() !== weekday) continue;
    last = iso;
    if (iso >= today) return iso;
  }
  return last;
}

/**
 * Gastos fijos del mes (EXPENSE con regla, sin préstamo) listos para mostrar, sobre `projectedPlan`.
 * Los totales van en ARS; cada ítem conserva su moneda. Ordenados por vencimiento (sin fecha, al final).
 */
export function fixedExpensesView(source: MonthPlan): FixedExpensesView {
  const plan = projectedPlan(source);
  const rules = new Map(plan.recurrings.map((r) => [r.id, r]));
  const names = new Map(plan.categories.map((c) => [c.id, c.name]));

  const items: FixedItem[] = plan.entries
    .filter((e) => e.period === plan.period && e.kind === "EXPENSE" && e.recurringId && !e.loanId)
    .map((e) => {
      const rule = rules.get(e.recurringId!);
      const frequency = rule?.frequency ?? "MONTHLY";
      const weekday = frequency === "WEEKLY" ? (rule?.weekday ?? null) : null;
      const dueDay = rule?.dueDay ?? null;
      const dueDate =
        frequency === "WEEKLY" && weekday != null
          ? weeklyDate(weekday, plan.period, plan.today)
          : (loanDueDate(dueDay, plan.period) ?? e.date);
      return {
        entryId: e.id.startsWith("proj-") ? null : e.id,
        recurringId: e.recurringId,
        name: e.name,
        amount: e.amount,
        currency: e.currency,
        unitAmount: rule?.amount ?? round2(e.amount / occurrencesInPeriod(frequency, plan.period, weekday)),
        frequency,
        weekday,
        dueDay,
        dueDate,
        isDone: e.isDone,
        categoryId: e.categoryId,
      };
    })
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.name.localeCompare(b.name));

  const ars = (i: FixedItem) => toArs(i.amount, i.currency, plan.usdRate);
  const byCategory = new Map<string | null, FixedItem[]>();
  for (const i of items) byCategory.set(i.categoryId, [...(byCategory.get(i.categoryId) ?? []), i]);
  const groups: FixedGroup[] = [...byCategory].map(([categoryId, list]) => ({
    categoryId,
    name: categoryId ? (names.get(categoryId) ?? "") : "",
    total: list.reduce((s, i) => s + ars(i), 0),
    items: list,
  }));

  const total = items.reduce((s, i) => s + ars(i), 0);
  const paid = items.filter((i) => i.isDone).reduce((s, i) => s + ars(i), 0);
  const due = items.find((i) => !i.isDone && i.dueDate && i.dueDate >= plan.today);

  return {
    projected: !source.started,
    total,
    paid,
    pending: total - paid,
    count: items.length,
    paidCount: items.filter((i) => i.isDone).length,
    nextDue: due ? { name: due.name, date: due.dueDate!, days: Math.round((utc(due.dueDate!) - utc(plan.today)) / DAY_MS) } : null,
    groups,
  };
}
