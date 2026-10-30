import type {
  AppNotice,
  CardPurchase,
  CardStatement,
  CardsOverview,
  Currency,
  HomeSummary,
  PendingPayment,
  WealthItem,
} from "./types";

/** "Hoy podés gastar": lo libre dividido en los días que quedan, redondeado hacia abajo al peso, nunca negativo. */
export function dailyAllowance(free: number, daysLeft: number): number {
  if (!Number.isFinite(free) || !Number.isFinite(daysLeft) || daysLeft <= 0) return 0;
  return Math.max(0, Math.floor(free / daysLeft));
}

/** Avance de fijos pagados, 0..1. */
export function fixedProgressRatio(fixed: HomeSummary["fixed"]): number {
  if (fixed.total <= 0) return 0;
  return Math.min(1, Math.max(0, fixed.paid / fixed.total));
}

/** Suma de gastos por categoría. */
export function spendingTotal(items: HomeSummary["spendingByCategory"]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

/** Número del globo de la campana: pagos por confirmar + avisos sin leer. */
export function notificationBadgeCount(pending: PendingPayment[], notices: AppNotice[]): number {
  return pending.length + notices.filter((n) => !n.read).length;
}

/** El mes de la mascota: capítulo 1..3 según avance (útil para tests). */
export function clampChapter(chapter: number, chapters = 3): number {
  return Math.min(chapters, Math.max(1, Math.round(chapter)));
}

// ───────────── Tarjetas y patrimonio ─────────────

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Suma `n` meses (puede ser negativo) a un período 'YYYY-MM'. */
export function addMonths(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const index = y * 12 + (m - 1) + n;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Meses de `a` a `b` (positivo si `b` es posterior). */
export function monthsBetween(a: string, b: string): number {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

/** Cuota de la compra que cae en `period`, o null si está fuera de rango. */
export function installmentFor(
  p: CardPurchase,
  period: string,
): { number: number; of: number; amount: number } | null {
  if (p.installments <= 0) return null;
  const number = monthsBetween(p.firstPeriod, period) + 1;
  if (number < 1 || number > p.installments) return null;
  return { number, of: p.installments, amount: round2(p.total / p.installments) };
}

export function toArs(amount: number, currency: Currency, usdRate: number): number {
  return currency === "USD" ? amount * usdRate : amount;
}

/** Resumen de una tarjeta en un mes + lo proyectado por cuotas (en ARS) para cuando no hay resumen. */
export function cardMonth(
  overview: CardsOverview,
  cardId: string,
  period: string,
): { statement: CardStatement | null; projectedArs: number; installmentsCount: number } {
  const statement = overview.statements.find((s) => s.cardId === cardId && s.period === period) ?? null;
  let projectedArs = 0;
  let installmentsCount = 0;
  for (const p of overview.purchases) {
    if (p.cardId !== cardId) continue;
    const inst = installmentFor(p, period);
    if (!inst) continue;
    installmentsCount += 1;
    projectedArs += toArs(inst.amount, p.currency, overview.usdRate);
  }
  return { statement, projectedArs, installmentsCount };
}

/** Días de `todayIso` a `dateIso` (negativo si ya pasó). Ambas 'YYYY-MM-DD'. */
export function daysUntil(dateIso: string, todayIso: string): number {
  const toUtc = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(dateIso) - toUtc(todayIso)) / 86_400_000);
}

export type StatementStatus = "paid" | "overdue" | "dueSoon" | "upcoming" | "estimated" | "empty";

export function statementStatus(
  statement: CardStatement | null,
  projectedArs: number,
  today: string,
): StatementStatus {
  if (!statement) return projectedArs > 0 ? "estimated" : "empty";
  if (statement.isPaid) return "paid";
  if (!statement.dueDate) return "upcoming";
  const days = daysUntil(statement.dueDate, today);
  if (days < 0) return "overdue";
  if (days <= 5) return "dueSoon";
  return "upcoming";
}

/** Totales del mes: lo que falta pagar (resúmenes sin pagar + estimados), lo pagado y el total. */
export function cardsTotals(
  overview: CardsOverview,
  period: string,
): { toPay: number; paid: number; total: number; estimated: number } {
  let toPay = 0;
  let paid = 0;
  let estimated = 0;
  for (const card of overview.cards) {
    const { statement, projectedArs } = cardMonth(overview, card.id, period);
    if (statement) {
      if (statement.isPaid) paid += statement.totalArs;
      else toPay += statement.totalArs;
    } else if (projectedArs > 0) {
      toPay += projectedArs;
      estimated += projectedArs;
    }
  }
  return { toPay, paid, total: toPay + paid, estimated };
}

/** Cuotas (en ARS) de los `months` meses desde `fromPeriod` inclusive. */
export function committedByMonth(
  purchases: CardPurchase[],
  fromPeriod: string,
  months: number,
  usdRate: number,
): { period: string; amount: number }[] {
  return Array.from({ length: Math.max(0, months) }, (_, i) => {
    const period = addMonths(fromPeriod, i);
    let amount = 0;
    for (const p of purchases) {
      const inst = installmentFor(p, period);
      if (inst) amount += toArs(inst.amount, p.currency, usdRate);
    }
    return { period, amount };
  });
}

/** Cuotas del mes de todas las tarjetas, de mayor a menor monto (en su moneda de origen). */
export function installmentsInPeriod(
  overview: CardsOverview,
  period: string,
): { purchase: CardPurchase; number: number; of: number; amount: number }[] {
  const list: { purchase: CardPurchase; number: number; of: number; amount: number }[] = [];
  for (const purchase of overview.purchases) {
    const inst = installmentFor(purchase, period);
    if (inst) list.push({ purchase, ...inst });
  }
  const ars = (x: (typeof list)[number]) => toArs(x.amount, x.purchase.currency, overview.usdRate);
  return list.sort((a, b) => ars(b) - ars(a));
}

/** Activos, deudas y neto en ARS. */
export function wealthTotals(items: WealthItem[], usdRate: number): { assets: number; debts: number; net: number } {
  let assets = 0;
  let debts = 0;
  for (const it of items) {
    const ars = toArs(it.amount, it.currency, usdRate);
    if (it.kind === "asset") assets += ars;
    else debts += ars;
  }
  return { assets, debts, net: assets - debts };
}

/** Variación del último mes vs el anterior; `ratio` sobre |anterior| (null si anterior = 0). */
export function wealthDelta(
  history: { period: string; netArs: number }[],
): { amount: number; ratio: number | null } | null {
  if (history.length < 2) return null;
  const last = history[history.length - 1].netArs;
  const prev = history[history.length - 2].netArs;
  return { amount: last - prev, ratio: prev === 0 ? null : (last - prev) / Math.abs(prev) };
}

/** Proporción del ítem dentro de su grupo (activos o deudas), 0..1. */
export function itemShare(item: WealthItem, items: WealthItem[], usdRate: number): number {
  const group = items.filter((i) => i.kind === item.kind);
  const total = group.reduce((sum, i) => sum + toArs(i.amount, i.currency, usdRate), 0);
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, toArs(item.amount, item.currency, usdRate) / total));
}
