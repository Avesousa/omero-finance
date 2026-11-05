import { isReceivable, round2, toArs, todayIso, type MonthPlan } from "../domain/index.ts";
import { fixedExpensesView } from "./fixed.ts";
import { statementToPay } from "../../../src/lib/plan/core.ts";

export type MovementsKind = "all" | "income" | "expense";

export interface MovementsFilter {
  kind?: MovementsKind;
  /** Texto libre: busca en nombre, categoría y nota (sin distinguir mayúsculas ni tildes). */
  query?: string;
}

export interface MovementItem {
  id: string;
  statement?: boolean;
  kind: "INCOME" | "EXPENSE";
  name: string;
  categoryId: string | null;
  /** null si no tiene categoría. */
  categoryName: string | null;
  amount: number;
  currency: "ARS" | "USD";
  /** Monto en ARS (para los totales). */
  amountArs: number;
  /** 'YYYY-MM-DD' o null (sin fecha). */
  date: string | null;
  isDone: boolean;
  /** Viene de una regla (gasto o ingreso fijo). */
  fixed: boolean;
  /** Cuota de un préstamo o deuda: solo lectura (se gestiona en Deudas). */
  installment: boolean;
  /** Cuota por cobrar; las no cobradas quedan fuera del historial. */
  receivable: boolean;
  /** Propuesta de un mes que no empezó (`proj-…`, `proposal-…`): no existe todavía, no se abre. */
  projected: boolean;
  /** Fijos, cuotas y resúmenes tienen estado pagado / pendiente. */
  hasStatus: boolean;
  note: string | null;
}

/** Un día de la lista (`date` 'YYYY-MM-DD'). */
export interface MovementDay {
  date: string;
  items: MovementItem[];
  /** Totales del día, en ARS. */
  income: number;
  expenses: number;
}

/** Grupo de avisos o movimientos sin fecha. */
export interface MovementGroup {
  items: MovementItem[];
  income: number;
  expenses: number;
}

export interface MovementsView {
  period: string;
  today: string;
  /** Movimientos del mes, con o sin filtro. Distingue "mes vacío" de "el filtro no encontró nada". */
  totalCount: number;
  /** Movimientos que pasan el filtro. */
  count: number;
  /** Días con fecha hasta hoy (o ya pagados), del más reciente al más viejo. */
  days: MovementDay[];
  /** Aviso exclusivo de Gastos, excluido de los totales realizados. */
  overdue: MovementGroup | null;
  /** "Sin fecha". Va al final. null si no hay. */
  undated: MovementGroup | null;
  /** Totales del filtro, en ARS: `balance` = ingresos − gastos. */
  totals: { income: number; expenses: number; balance: number };
}

/** Minúsculas y sin tildes, para buscar. */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Historial real del mes y aviso de vencidos en Gastos; no genera proyecciones. */
export function movementsView(source: MonthPlan, filter: MovementsFilter = {}): MovementsView {
  const plan = source;
  const fixedDates = new Map(fixedExpensesView(source).groups.flatMap((g) => g.items).map((i) => [i.entryId, i.dueDate]));
  const kind = filter.kind ?? "all";
  const q = normalizeSearch(filter.query ?? "");
  const categories = new Map(plan.categories.map((c) => [c.id, c.name]));

  const all: MovementItem[] = plan.entries
    .filter((e) => e.period === plan.period && !e.id.startsWith("proj-") && !e.id.startsWith("proposal-"))
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      name: e.name,
      categoryId: e.categoryId,
      categoryName: e.categoryId ? (categories.get(e.categoryId) ?? null) : null,
      amount: e.amount,
      currency: e.currency,
      amountArs: toArs(e.amount, e.currency, plan.usdRate),
      date: e.isDone ? (e.collectedAt ?? e.date) : (fixedDates.get(e.id) ?? e.date),
      isDone: e.isDone,
      fixed: e.recurringId != null && e.loanId == null,
      installment: e.loanId != null,
      receivable: isReceivable(e),
      projected: e.id.startsWith("proj-") || e.id.startsWith("proposal-"),
      hasStatus: e.recurringId != null || e.loanId != null,
      note: e.note,
    }));

  for (const st of plan.statements.filter((s) => s.period === plan.period)) {
    const card = plan.cards.find((c) => c.id === st.cardId);
    all.push({
      id: `statement-${st.id}`, statement: true, kind: "EXPENSE",
      name: card?.name ?? "Tarjeta", categoryId: null, categoryName: "Pago de tarjeta",
      amount: statementToPay(st, plan.usdRate), currency: "ARS",
      amountArs: statementToPay(st, plan.usdRate),
      date: st.isPaid ? (st.paidAt ? todayIso(new Date(st.paidAt)) : null) : st.dueDate,
      isDone: st.isPaid, fixed: false, installment: false, receivable: false,
      projected: false, hasStatus: true, note: null,
    });
  }
  const matches = (m: MovementItem) =>
    (kind === "all" || (kind === "income" ? m.kind === "INCOME" : m.kind === "EXPENSE")) &&
    (!q || [m.name, m.categoryName ?? "", m.note ?? ""].some((s) => normalizeSearch(s).includes(q)));
  const realized = all.filter((m) => m.isDone || !m.hasStatus);
  const items = realized.filter(matches).sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? "") || Number(b.kind === "INCOME") - Number(a.kind === "INCOME") || a.name.localeCompare(b.name));
  const overdueItems = kind === "expense" ? all.filter((m) =>
    m.kind === "EXPENSE" && m.hasStatus && !m.isDone && m.date != null && m.date < plan.today && matches(m)
  ).sort((a, b) => a.date!.localeCompare(b.date!) || a.name.localeCompare(b.name)) : [];

  const sum = (list: MovementItem[], k: MovementItem["kind"]) =>
    round2(list.filter((m) => m.kind === k && !m.receivable).reduce((acc, m) => acc + m.amountArs, 0));
  const group = (list: MovementItem[]): MovementGroup | null =>
    list.length === 0 ? null : { items: list, income: sum(list, "INCOME"), expenses: sum(list, "EXPENSE") };

  const byDay = new Map<string, MovementItem[]>();
  for (const m of items) if (m.date != null) byDay.set(m.date, [...(byDay.get(m.date) ?? []), m]);
  const days: MovementDay[] = [...byDay.entries()]
    .map(([date, list]) => ({ date, items: list, income: sum(list, "INCOME"), expenses: sum(list, "EXPENSE") }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const income = sum(items, "INCOME");
  const expenses = sum(items, "EXPENSE");
  return {
    period: plan.period,
    today: plan.today,
    totalCount: realized.length,
    count: items.length,
    days,
    overdue: group(overdueItems),
    undated: group(items.filter((m) => m.date == null)),
    totals: { income, expenses, balance: round2(income - expenses) },
  };
}

/** Ingresos recurrentes persistidos por confirmar; excluye propuestas y cobros de préstamos. */
export function pendingIncomes(plan: MonthPlan) {
  return plan.entries.filter((e) => e.period === plan.period && e.kind === "INCOME" && e.recurringId != null && e.loanId == null && !e.isDone && !e.id.startsWith("proj-") && !e.id.startsWith("proposal-"));
}
