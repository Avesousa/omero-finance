import {
  addMonths,
  balanceAt,
  frenchInstallment,
  isLoanFinished,
  loanBalanceItem,
  loanDueDate,
  loanState,
  monthDiff,
  monthlyRatePct,
  proposeLoanPayment,
  round2,
  toArs,
} from "../domain/index.ts";
import type { LoanDTO } from "../domain";
import type {
  AppNotice,
  CardPurchase,
  CardStatement,
  CardsDebt,
  CardsOverview,
  DebtsOverview,
  DebtsTotals,
  HomeSummary,
  LoanPreview,
  LoanRow,
  NewLoanInput,
  NestChapter,
  PendingPayment,
  WealthGoal,
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

// La aritmética de períodos y monedas es la de core (web): se re-exporta para no romper imports.
export { addMonths, toArs };

/** Meses de `a` a `b` (positivo si `b` es posterior). */
export function monthsBetween(a: string, b: string): number {
  return monthDiff(a, b);
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

// ───────────── El nido ─────────────

/** Qué parte de lo que tenés es realmente tuyo: activos / (activos + deudas), 0..1 (0 si ambos son 0). */
export function equityRatio(assets: number, debts: number): number {
  const total = assets + debts;
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.min(1, Math.max(0, assets / total));
}

/**
 * Etapa del nido según `equity` (0..1): capítulo 1 si < 1/3, 2 si < 2/3, 3 si >= 2/3.
 * `progress` es el avance dentro del tercio (el capítulo 3 llega a 1 con equity 1).
 */
export function nestStage(equity: number): { chapter: NestChapter; progress: number; equity: number } {
  const e = Number.isFinite(equity) ? Math.min(1, Math.max(0, equity)) : 0;
  const x = e * 3;
  const chapter: NestChapter = x < 1 ? 1 : x < 2 ? 2 : 3;
  return { chapter, progress: Math.min(1, Math.max(0, x - (chapter - 1))), equity: e };
}

/** Avance de una meta: `ratio` 0..1, lo que `missing` (>= 0) y los meses que faltan si hay aporte mensual. */
export function goalProgress(goal: WealthGoal): { ratio: number; missing: number; monthsLeft: number | null } {
  const ratio = goal.target > 0 ? Math.min(1, Math.max(0, goal.saved / goal.target)) : 0;
  const missing = Math.max(0, goal.target - goal.saved);
  const monthsLeft = goal.monthly != null && goal.monthly > 0 ? Math.ceil(missing / goal.monthly) : null;
  return { ratio, missing, monthsLeft };
}

// ───────────── Deudas y préstamos ─────────────

/**
 * Deuda de tarjetas en `period`: lo que falta pagar de los resúmenes más lo estimado por cuotas
 * (mismo `toPay` que Tarjetas). Una sola cuenta para Tarjetas, Deudas y Patrimonio.
 */
export function cardsDebt(overview: CardsOverview, period: string): CardsDebt {
  let count = 0;
  let nextDue: string | null = null;
  for (const card of overview.cards) {
    const { statement, projectedArs } = cardMonth(overview, card.id, period);
    const owes = statement ? !statement.isPaid && statement.totalArs > 0 : projectedArs > 0;
    if (!owes) continue;
    count += 1;
    if (statement?.dueDate && (nextDue === null || statement.dueDate < nextDue)) nextDue = statement.dueDate;
  }
  return { count, debtArs: round2(cardsTotals(overview, period).toPay), nextDue };
}

/** Cuota del mes: la generada de ese período si existe; si no, la propuesta. Null si no corresponde. */
function monthPaymentOf(loan: LoanDTO, period: string): { number: number | null; payment: LoanRow["monthPayment"] } {
  const dueDate = loanDueDate(loan.dueDay, period);
  const idx = loan.payments.findIndex((p) => p.period === period);
  if (idx >= 0) {
    const p = loan.payments[idx];
    return {
      number: loan.mode === "OPEN" ? null : idx + 1,
      payment: { amount: p.amount, interest: p.interest, dueDate, isDone: p.isDone },
    };
  }
  // Sin cuotas fijas, sin pago sugerido y sin historial: no hay "cuota del mes" que mostrar.
  if (loan.mode === "OPEN" && loan.installmentAmount == null && loan.payments.length === 0) {
    return { number: null, payment: null };
  }
  const proposal = proposeLoanPayment(loan, period);
  if (!proposal) return { number: null, payment: null };
  return {
    number: proposal.number,
    payment: { amount: proposal.amount, interest: proposal.interest, dueDate, isDone: false },
  };
}

/** Un préstamo para mostrar en `period` (capital al cierre de ese mes, cuota del mes, avance, tasa). */
export function loanRow(loan: LoanDTO, period: string, usdRate: number): LoanRow {
  const state = loanState(loan, addMonths(period, 1));
  const capital = state.capital;
  const { number, payment } = monthPaymentOf(loan, period);

  let paidRatio: number;
  if (loan.mode === "FIXED") {
    paidRatio = loan.installments ? state.paidCount / Math.max(1, loan.installments) : 0;
  } else if (loan.mode === "SCHEDULE") {
    paidRatio = loan.schedule.length > 0 ? state.paidCount / loan.schedule.length : 0;
  } else {
    paidRatio = loan.principal > 0 ? 1 - capital / loan.principal : 0;
  }
  paidRatio = Math.min(1, Math.max(0, paidRatio));

  const installmentsTotal =
    loan.mode === "FIXED" ? Math.max(1, loan.installments ?? 1) : loan.mode === "SCHEDULE" ? loan.schedule.length : null;

  return {
    id: loan.id,
    direction: loan.direction,
    mode: loan.mode,
    name: loan.name,
    counterpart: loan.counterpart,
    currency: loan.currency,
    capital,
    capitalArs: round2(toArs(capital, loan.currency, usdRate)),
    paidRatio,
    installmentNumber: installmentsTotal === null ? null : number ?? Math.min(state.paidCount, installmentsTotal),
    installmentsTotal,
    monthPayment: payment,
    rate: loan.interestRate && loan.interestRate > 0
      ? { pct: loan.interestRate, annual: !!loan.interestAnnual, withTax: !!loan.interestTaxPct }
      : null,
    finished: loan.isClosed || isLoanFinished(loan),
  };
}

/** Totales de la pantalla Deudas (en ARS). Los préstamos terminados no suman. */
export function debtsTotals(overview: DebtsOverview): DebtsTotals {
  let oweArs = overview.cards.debtArs;
  let owedArs = 0;
  let monthToPayArs = overview.cards.debtArs;
  let monthToCollectArs = 0;
  let paidThisMonthArs = 0;
  for (const loan of overview.loans) {
    const row = loanRow(loan, overview.period, overview.usdRate);
    if (row.finished) continue;
    const pay = row.monthPayment ? toArs(row.monthPayment.amount, row.currency, overview.usdRate) : 0;
    if (row.direction === "OWE") {
      oweArs += row.capitalArs;
      if (row.monthPayment) {
        if (row.monthPayment.isDone) paidThisMonthArs += pay;
        else monthToPayArs += pay;
      }
    } else {
      owedArs += row.capitalArs;
      if (row.monthPayment && !row.monthPayment.isDone) monthToCollectArs += pay;
    }
  }
  return {
    oweArs: round2(oweArs),
    owedArs: round2(owedArs),
    monthToPayArs: round2(monthToPayArs),
    monthToCollectArs: round2(monthToCollectArs),
    paidThisMonthArs: round2(paidThisMonthArs),
  };
}

const PREVIEW_MAX_MONTHS = 600;
const EMPTY_PREVIEW: LoanPreview = { installment: null, totalToPay: null, totalInterest: null, endPeriod: null };

/** Vista previa del formulario "Nueva deuda". Todo null si faltan datos. */
export function previewLoan(input: NewLoanInput): LoanPreview {
  const { principal, startPeriod } = input;
  if (!(principal > 0) || !/^\d{4}-\d{2}$/.test(startPeriod)) return EMPTY_PREVIEW;
  const ratePct = monthlyRatePct(
    { interestRate: input.interestRate, interestFrequency: "MONTHLY", interestAnnual: input.interestAnnual, interestTaxPct: input.interestTaxPct },
    startPeriod,
  );

  if (input.mode === "FIXED") {
    const n = Math.floor(input.installments ?? 0);
    if (n < 1) return EMPTY_PREVIEW;
    const installment = frenchInstallment(principal, ratePct, n);
    const totalToPay = round2(installment * n);
    return {
      installment,
      totalToPay,
      totalInterest: round2(Math.max(0, totalToPay - principal)),
      endPeriod: addMonths(startPeriod, n - 1),
    };
  }

  // OPEN: solo hay estimación si se sugiere un pago mensual.
  const pay = input.installmentAmount ?? 0;
  if (!(pay > 0)) return EMPTY_PREVIEW;
  let balance = principal;
  let total = 0;
  for (let i = 0; i < PREVIEW_MAX_MONTHS; i++) {
    balance += balance * ratePct / 100;
    const paid = Math.min(pay, balance);
    balance -= paid;
    total += paid;
    if (balance <= 0.5) {
      return {
        installment: pay,
        totalToPay: round2(total),
        totalInterest: round2(Math.max(0, total - principal)),
        endPeriod: addMonths(startPeriod, i),
      };
    }
  }
  return { ...EMPTY_PREVIEW, installment: pay };
}

/**
 * Ítems de patrimonio que salen de las deudas: un ítem por préstamo abierto (OWE = deuda,
 * OWED = activo "Me deben") y uno por las tarjetas. `previous` = cierre del mes anterior.
 */
export function derivedWealthItems(
  loans: LoanDTO[],
  cards: CardsOverview,
  period: string,
  usdRate: number,
  owedPrefix = "Me deben: ",
): WealthItem[] {
  const items: WealthItem[] = [];
  for (const loan of loans) {
    const row = loanRow(loan, period, usdRate);
    if (row.finished && row.capital <= 0) continue;
    const balance = loanBalanceItem(loan);
    const amount = balanceAt(balance, period) ?? loan.principal;
    const previous = balanceAt(balance, addMonths(period, -1));
    const fixedLike = loan.mode !== "OPEN";
    items.push({
      id: `loan-${loan.id}`,
      kind: loan.direction === "OWE" ? "debt" : "asset",
      source: "loan",
      name: loan.direction === "OWED" ? `${owedPrefix}${loan.name}` : loan.name,
      currency: loan.currency,
      amount,
      previous,
      loan: {
        paidRatio: row.paidRatio,
        installmentsLeft: fixedLike && row.installmentsTotal !== null
          ? Math.max(0, row.installmentsTotal - Math.round(row.paidRatio * row.installmentsTotal))
          : null,
      },
    });
  }
  const now = cardsDebt(cards, period).debtArs;
  if (now > 0 || cards.statements.length > 0) {
    items.push({
      id: "cards",
      kind: "debt",
      source: "card",
      name: "Tarjetas",
      currency: "ARS",
      amount: now,
      previous: cardsDebt(cards, addMonths(period, -1)).debtArs,
    });
  }
  return items;
}
