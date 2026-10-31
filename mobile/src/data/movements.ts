import { isReceivable, round2, toArs, type MonthPlan } from "../domain/index.ts";
import { projectedPlan } from "./plan.ts";

export type MovementsKind = "all" | "income" | "expense";

export interface MovementsFilter {
  kind?: MovementsKind;
  /** Texto libre: busca en nombre, categoría y nota (sin distinguir mayúsculas ni tildes). */
  query?: string;
}

export interface MovementItem {
  id: string;
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
  /** Cuota que me deben y todavía no cobré: se ve en la lista pero no suma a los ingresos (igual que `buildSummary`). */
  receivable: boolean;
  /** Propuesta de un mes que no empezó (`proj-…`, `proposal-…`): no existe todavía, no se abre. */
  projected: boolean;
  /** Solo los fijos y las cuotas tienen estado pagado / pendiente. */
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

/** Grupo sin día propio ("Próximos", "Sin fecha"). */
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
  /** "Próximos": fecha posterior a hoy y sin pagar, el que vence antes primero. Va después de `days`. null si no hay. */
  upcoming: MovementGroup | null;
  /** "Sin fecha". Va al final. null si no hay. */
  undated: MovementGroup | null;
  /** Totales del filtro, en ARS: `balance` = ingresos − gastos. */
  totals: { income: number; expenses: number; balance: number };
}

/** Minúsculas y sin tildes, para buscar. */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Movimientos del mes (ingresos y gastos, incluidos fijos y cuotas) listos para mostrar, sobre `projectedPlan`.
 * Orden: días pasados (desc), luego "Próximos" (fecha futura y sin pagar, asc) y al final "Sin fecha"; dentro del día, ingresos primero y luego por nombre.
 * Agrupa por día; los totales (en ARS) son los del filtro y, como Inicio, no cuentan lo que me deben y todavía no cobré.
 */
export function movementsView(source: MonthPlan, filter: MovementsFilter = {}): MovementsView {
  const plan = projectedPlan(source);
  const kind = filter.kind ?? "all";
  const q = normalizeSearch(filter.query ?? "");
  const categories = new Map(plan.categories.map((c) => [c.id, c.name]));

  const all: MovementItem[] = plan.entries
    .filter((e) => e.period === plan.period)
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      name: e.name,
      categoryId: e.categoryId,
      categoryName: e.categoryId ? (categories.get(e.categoryId) ?? null) : null,
      amount: e.amount,
      currency: e.currency,
      amountArs: toArs(e.amount, e.currency, plan.usdRate),
      date: e.date,
      isDone: e.isDone,
      fixed: e.recurringId != null && e.loanId == null,
      installment: e.loanId != null,
      receivable: isReceivable(e),
      projected: e.id.startsWith("proj-") || e.id.startsWith("proposal-"),
      hasStatus: e.recurringId != null || e.loanId != null,
      note: e.note,
    }));

  const items = all
    .filter((m) => kind === "all" || (kind === "income" ? m.kind === "INCOME" : m.kind === "EXPENSE"))
    .filter((m) => !q || [m.name, m.categoryName ?? "", m.note ?? ""].some((s) => normalizeSearch(s).includes(q)))
    .sort(
      (a, b) =>
        (b.date ?? "").localeCompare(a.date ?? "") ||
        Number(a.date == null) - Number(b.date == null) ||
        Number(b.kind === "INCOME") - Number(a.kind === "INCOME") ||
        a.name.localeCompare(b.name),
    );

  const sum = (list: MovementItem[], k: MovementItem["kind"]) =>
    round2(list.filter((m) => m.kind === k && !m.receivable).reduce((acc, m) => acc + m.amountArs, 0));
  const group = (list: MovementItem[]): MovementGroup | null =>
    list.length === 0 ? null : { items: list, income: sum(list, "INCOME"), expenses: sum(list, "EXPENSE") };

  const isUpcoming = (m: MovementItem) => m.date != null && m.date > plan.today && !m.isDone;
  const upcomingItems = items
    .filter(isUpcoming)
    .sort((a, b) => a.date!.localeCompare(b.date!) || Number(b.kind === "INCOME") - Number(a.kind === "INCOME") || a.name.localeCompare(b.name));
  const byDay = new Map<string, MovementItem[]>();
  for (const m of items) if (m.date != null && !isUpcoming(m)) byDay.set(m.date, [...(byDay.get(m.date) ?? []), m]);
  const days: MovementDay[] = [...byDay.entries()]
    .map(([date, list]) => ({ date, items: list, income: sum(list, "INCOME"), expenses: sum(list, "EXPENSE") }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const income = sum(items, "INCOME");
  const expenses = sum(items, "EXPENSE");
  return {
    period: plan.period,
    today: plan.today,
    totalCount: all.length,
    count: items.length,
    days,
    upcoming: group(upcomingItems),
    undated: group(items.filter((m) => m.date == null)),
    totals: { income, expenses, balance: round2(income - expenses) },
  };
}
