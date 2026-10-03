/**
 * Plan simple — lógica pura (sin DB, sin React).
 * Se puede importar desde el servidor y desde componentes cliente.
 *
 * El mes se representa como "YYYY-MM" (`period`).
 */

export type Currency = "ARS" | "USD";
export type Kind = "INCOME" | "EXPENSE";
export type Frequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
export type PayMode = "TOTAL" | "MINIMUM" | "CUSTOM";
export type BalanceType = "ASSET" | "DEBT";

export const TDC_KEY = "TDC";
const TZ = "America/Argentina/Buenos_Aires";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CategoryDTO {
  id: string;
  kind: Kind;
  name: string;
  systemKey: string | null;
  isArchived: boolean;
  sortOrder: number;
}

export interface RecurringDTO {
  id: string;
  kind: Kind;
  name: string;
  categoryId: string | null;
  targetCategoryId: string | null;
  currency: Currency;
  /** Monto por ocurrencia (por día / semana / quincena / mes). */
  amount: number;
  frequency: Frequency;
  weekday: number | null;
  dueDay: number | null;
  isActive: boolean;
}

export interface EntryDTO {
  id: string;
  period: string;
  kind: Kind;
  recurringId: string | null;
  name: string;
  categoryId: string | null;
  targetCategoryId: string | null;
  currency: Currency;
  amount: number;
  date: string | null;
  isDone: boolean;
  note: string | null;
}

export interface BudgetDTO {
  categoryId: string;
  amount: number;
}

export interface CardDTO {
  id: string;
  /** Nombre heredado de la app clásica; puede ser una sigla ("VISA AVELINO BN"). */
  name: string;
  /** Banco o entidad emisora. */
  entity: string | null;
  /** "VISA" | "MC" | "AMEX" */
  cardType: string | null;
  ownerName: string | null;
}

export interface PurchaseDTO {
  id: string;
  cardId: string;
  description: string;
  categoryId: string | null;
  currency: Currency;
  amount: number;
  installments: number;
  firstPeriod: string;
  purchaseDate: string | null;
  note: string | null;
}

export interface StatementDTO {
  id: string;
  cardId: string;
  period: string;
  dueDate: string | null;
  totalArs: number;
  minimumArs: number | null;
  usdAmount: number | null;
  payMode: PayMode;
  customAmount: number | null;
  isPaid: boolean;
}

export interface BalanceItemDTO {
  id: string;
  type: BalanceType;
  name: string;
  currency: Currency;
  isArchived: boolean;
  /** period → saldo */
  values: Record<string, number>;
}

/** Fila de la propuesta de "inicio de mes" (un fijo que se trae de la regla). */
export interface ProposalRow {
  recurringId: string;
  kind: Kind;
  name: string;
  categoryId: string | null;
  currency: Currency;
  frequency: Frequency;
  unitAmount: number;
  occurrences: number;
  amount: number;
}

// ─── Períodos ─────────────────────────────────────────────────────────────────

export function isValidPeriod(p: unknown): p is string {
  if (typeof p !== "string" || !/^\d{4}-\d{2}$/.test(p)) return false;
  const m = Number(p.slice(5));
  return m >= 1 && m <= 12;
}

/** Mes actual en hora de Buenos Aires (evita el corrimiento de UTC a fin de mes). */
export function currentPeriod(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}`;
}

/** Fecha de hoy "YYYY-MM-DD" en hora de Buenos Aires. */
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

/** Suma días a una fecha "YYYY-MM-DD". */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function split(period: string): [number, number] {
  return [Number(period.slice(0, 4)), Number(period.slice(5, 7))];
}

export function addMonths(period: string, n: number): string {
  const [y, m] = split(period);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** Cantidad de meses de `from` a `to` (positivo si `to` es posterior). */
export function monthDiff(from: string, to: string): number {
  const [fy, fm] = split(from);
  const [ty, tm] = split(to);
  return (ty - fy) * 12 + (tm - fm);
}

export function periodLabel(period: string): string {
  const [y, m] = split(period);
  return `${MONTHS[m - 1]} ${y}`;
}

export function periodShort(period: string): string {
  const [y, m] = split(period);
  return `${MONTHS[m - 1].slice(0, 3)} ${String(y).slice(2)}`;
}

export function daysInPeriod(period: string): number {
  const [y, m] = split(period);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// ─── Recurrencia ──────────────────────────────────────────────────────────────

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  MONTHLY: "Mensual",
  BIWEEKLY: "Quincenal",
  WEEKLY: "Semanal",
  DAILY: "Diario",
};

export const FREQUENCY_UNIT: Record<Frequency, string> = {
  MONTHLY: "por mes",
  BIWEEKLY: "por quincena",
  WEEKLY: "por semana",
  DAILY: "por día",
};

/**
 * Cuántas veces ocurre una regla dentro de un mes.
 *  - Mensual: 1 · Quincenal: 2 · Diario: días del mes
 *  - Semanal: veces que cae ese día de la semana en el mes (4 o 5);
 *    si no se indicó el día, 4.
 */
export function occurrencesInPeriod(
  frequency: Frequency,
  period: string,
  weekday?: number | null,
): number {
  switch (frequency) {
    case "MONTHLY":
      return 1;
    case "BIWEEKLY":
      return 2;
    case "DAILY":
      return daysInPeriod(period);
    case "WEEKLY": {
      if (weekday == null || weekday < 0 || weekday > 6) return 4;
      const [y, m] = split(period);
      const days = daysInPeriod(period);
      let count = 0;
      for (let d = 1; d <= days; d++) {
        if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === weekday) count++;
      }
      return count;
    }
  }
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Monto total del mes para una regla: monto por vez × veces en el mes. */
export function monthlyAmount(
  unitAmount: number,
  frequency: Frequency,
  period: string,
  weekday?: number | null,
): number {
  return round2(unitAmount * occurrencesInPeriod(frequency, period, weekday));
}

export function buildProposal(recurrings: RecurringDTO[], period: string): ProposalRow[] {
  return recurrings
    .filter((r) => r.isActive)
    .map((r) => {
      const occurrences = occurrencesInPeriod(r.frequency, period, r.weekday);
      return {
        recurringId: r.id,
        kind: r.kind,
        name: r.name,
        categoryId: r.categoryId,
        currency: r.currency,
        frequency: r.frequency,
        unitAmount: r.amount,
        occurrences,
        amount: round2(r.amount * occurrences),
      };
    });
}

// ─── Moneda ───────────────────────────────────────────────────────────────────

export function toArs(amount: number, currency: Currency, usdRate: number): number {
  return currency === "USD" ? amount * usdRate : amount;
}

// ─── Tarjetas ─────────────────────────────────────────────────────────────────

export interface Installment {
  number: number;
  of: number;
  amount: number;
}

/** La cuota de una compra que cae en `period`, o null si no cae ninguna. */
export function installmentFor(
  purchase: Pick<PurchaseDTO, "amount" | "installments" | "firstPeriod">,
  period: string,
): Installment | null {
  const n = Math.max(1, purchase.installments);
  const idx = monthDiff(purchase.firstPeriod, period);
  if (idx < 0 || idx >= n) return null;
  return { number: idx + 1, of: n, amount: round2(purchase.amount / n) };
}

/** Cuánto se va a pagar de un resumen según la decisión tomada. */
export function statementToPay(
  st: Pick<StatementDTO, "totalArs" | "minimumArs" | "usdAmount" | "payMode" | "customAmount">,
  usdRate: number,
): number {
  const full = st.totalArs + (st.usdAmount ?? 0) * usdRate;
  if (st.payMode === "MINIMUM") return st.minimumArs ?? full;
  if (st.payMode === "CUSTOM") return st.customAmount ?? full;
  return full;
}

const BRAND_LABEL: Record<string, string> = { VISA: "Visa", MC: "Mastercard", AMEX: "Amex" };

export function cardBrandLabel(cardType: string | null): string | null {
  if (!cardType?.trim()) return null;
  return BRAND_LABEL[cardType.trim().toUpperCase()] ?? cardType.trim();
}

/** Lo que más identifica a la tarjeta: el banco. Si no está cargado, el nombre heredado. */
export function cardTitle(card: CardDTO): string {
  return card.entity?.trim() || card.name;
}

/** Marca y titular: "Visa · Avelino". Vacío si no hay ninguno de los dos. */
export function cardSubtitle(card: CardDTO): string {
  return [cardBrandLabel(card.cardType), card.ownerName?.trim()].filter(Boolean).join(" · ");
}

/** Todo en una línea, para listas y avisos: "Galicia · Visa · Avelino". */
export function cardLabel(card: CardDTO): string {
  return [cardTitle(card), cardSubtitle(card)].filter(Boolean).join(" · ");
}

export interface CardLine {
  cardId: string;
  cardName: string;
  statement: StatementDTO | null;
  /** Suma de cuotas cargadas que caen en el mes (en ARS). */
  projectedArs: number;
  /** Lo que cuenta para el mes: el resumen si está cargado, si no las cuotas. */
  toPayArs: number;
  isEstimate: boolean;
  isPaid: boolean;
}

export function cardLines(
  cards: CardDTO[],
  statements: StatementDTO[],
  purchases: PurchaseDTO[],
  period: string,
  usdRate: number,
): CardLine[] {
  return cards
    .map((card) => {
      const statement =
        statements.find((s) => s.cardId === card.id && s.period === period) ?? null;
      const projectedArs = purchases
        .filter((p) => p.cardId === card.id)
        .reduce((sum, p) => {
          const inst = installmentFor(p, period);
          return inst ? sum + toArs(inst.amount, p.currency, usdRate) : sum;
        }, 0);
      const toPayArs = statement ? statementToPay(statement, usdRate) : projectedArs;
      return {
        cardId: card.id,
        cardName: cardLabel(card),
        statement,
        projectedArs,
        toPayArs,
        isEstimate: !statement && projectedArs > 0,
        isPaid: statement?.isPaid ?? false,
      };
    })
    .filter((l) => l.statement !== null || l.projectedArs > 0);
}

export interface ProjectionMonth {
  period: string;
  totalArs: number;
  count: number;
}

/** Cuotas ya comprometidas para los próximos meses (incluye el mes `from`). */
export function projectInstallments(
  purchases: PurchaseDTO[],
  from: string,
  months: number,
  usdRate: number,
): ProjectionMonth[] {
  const out: ProjectionMonth[] = [];
  for (let i = 0; i < months; i++) {
    const period = addMonths(from, i);
    let totalArs = 0;
    let count = 0;
    for (const p of purchases) {
      const inst = installmentFor(p, period);
      if (inst) {
        totalArs += toArs(inst.amount, p.currency, usdRate);
        count++;
      }
    }
    out.push({ period, totalArs, count });
  }
  return out;
}

// ─── Resumen del mes y presupuesto ────────────────────────────────────────────

export type BudgetStatus = "ok" | "near" | "over" | "unbudgeted" | "unused";

export interface BudgetRow {
  /** null = gastos sin categoría */
  categoryId: string | null;
  name: string;
  isCards: boolean;
  budget: number;
  actual: number;
  /** Ingresos destinados a esta categoría. */
  earmarked: number;
  /** budget − actual (negativo = te pasaste). */
  remaining: number;
  status: BudgetStatus;
}

export interface Summary {
  incomeArs: number;
  incomeFixedArs: number;
  incomeVariableArs: number;
  incomeReceivedArs: number;
  fixedArs: number;
  fixedPaidArs: number;
  variableArs: number;
  cardsArs: number;
  cardsHasEstimate: boolean;
  spentArs: number;
  /** Ingresos − gastos fijos − gastos variables − tarjetas. */
  availableArs: number;
  budgetTotalArs: number;
  /** Ingresos − total presupuestado (positivo = plata sin destino). */
  unassignedArs: number;
  rows: BudgetRow[];
  overRows: BudgetRow[];
}

export const NEAR_THRESHOLD = 0.85;

function budgetStatus(budget: number, actual: number): BudgetStatus {
  if (budget <= 0) return actual > 0 ? "unbudgeted" : "unused";
  if (actual > budget + 0.005) return "over";
  if (actual >= budget * NEAR_THRESHOLD) return "near";
  return "ok";
}

export interface SummaryInput {
  period: string;
  usdRate: number;
  categories: CategoryDTO[];
  entries: EntryDTO[];
  budgets: BudgetDTO[];
  cards: CardDTO[];
  statements: StatementDTO[];
  purchases: PurchaseDTO[];
}

export function buildSummary(input: SummaryInput): Summary {
  const { period, usdRate, categories, budgets } = input;
  const entries = input.entries.filter((e) => e.period === period);
  const ars = (e: EntryDTO) => toArs(e.amount, e.currency, usdRate);
  const sum = (list: EntryDTO[]) => list.reduce((s, e) => s + ars(e), 0);

  const incomes = entries.filter((e) => e.kind === "INCOME");
  const expenses = entries.filter((e) => e.kind === "EXPENSE");
  const fixedExpenses = expenses.filter((e) => e.recurringId);
  const variableExpenses = expenses.filter((e) => !e.recurringId);

  const lines = cardLines(input.cards, input.statements, input.purchases, period, usdRate);
  const cardsArs = lines.reduce((s, l) => s + l.toPayArs, 0);

  const incomeArs = sum(incomes);
  const fixedArs = sum(fixedExpenses);
  const variableArs = sum(variableExpenses);
  const spentArs = fixedArs + variableArs + cardsArs;

  // ── Presupuesto vs real, por categoría de gasto ──
  const expenseCats = categories
    .filter((c) => c.kind === "EXPENSE")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const budgetBy = new Map(budgets.map((b) => [b.categoryId, b.amount]));
  const actualBy = new Map<string | null, number>();
  for (const e of expenses) {
    actualBy.set(e.categoryId, (actualBy.get(e.categoryId) ?? 0) + ars(e));
  }
  const earmarkBy = new Map<string, number>();
  for (const e of incomes) {
    if (e.targetCategoryId) {
      earmarkBy.set(e.targetCategoryId, (earmarkBy.get(e.targetCategoryId) ?? 0) + ars(e));
    }
  }

  const rows: BudgetRow[] = [];
  for (const c of expenseCats) {
    const isCards = c.systemKey === TDC_KEY;
    const budget = budgetBy.get(c.id) ?? 0;
    const actual = isCards ? cardsArs : actualBy.get(c.id) ?? 0;
    const earmarked = earmarkBy.get(c.id) ?? 0;
    if (budget <= 0 && actual <= 0 && earmarked <= 0) continue;
    rows.push({
      categoryId: c.id,
      name: c.name,
      isCards,
      budget,
      actual,
      earmarked,
      remaining: budget - actual,
      status: budgetStatus(budget, actual),
    });
  }
  const uncategorized = actualBy.get(null) ?? 0;
  if (uncategorized > 0) {
    rows.push({
      categoryId: null,
      name: "Sin categoría",
      isCards: false,
      budget: 0,
      actual: uncategorized,
      earmarked: 0,
      remaining: -uncategorized,
      status: "unbudgeted",
    });
  }

  const budgetTotalArs = budgets.reduce((s, b) => s + b.amount, 0);

  return {
    incomeArs,
    incomeFixedArs: sum(incomes.filter((e) => e.recurringId)),
    incomeVariableArs: sum(incomes.filter((e) => !e.recurringId)),
    incomeReceivedArs: sum(incomes.filter((e) => !e.recurringId || e.isDone)),
    fixedArs,
    fixedPaidArs: sum(fixedExpenses.filter((e) => e.isDone)),
    variableArs,
    cardsArs,
    cardsHasEstimate: lines.some((l) => l.isEstimate),
    spentArs,
    availableArs: incomeArs - spentArs,
    budgetTotalArs,
    unassignedArs: incomeArs - budgetTotalArs,
    rows,
    overRows: rows.filter((r) => r.status === "over"),
  };
}

// ─── Patrimonio ───────────────────────────────────────────────────────────────

/** Saldo de un ítem en `period`: el del mes o, si falta, el último anterior. */
export function balanceAt(item: BalanceItemDTO, period: string): number | null {
  if (item.values[period] != null) return item.values[period];
  const earlier = Object.keys(item.values)
    .filter((p) => p < period)
    .sort();
  if (earlier.length === 0) return null;
  return item.values[earlier[earlier.length - 1]];
}

export interface NetWorth {
  assetsArs: number;
  debtsArs: number;
  netArs: number;
}

export function netWorth(items: BalanceItemDTO[], period: string, usdRate: number): NetWorth {
  let assetsArs = 0;
  let debtsArs = 0;
  for (const item of items) {
    if (item.isArchived) continue;
    const v = balanceAt(item, period);
    if (v == null) continue;
    const ars = toArs(v, item.currency, usdRate);
    if (item.type === "ASSET") assetsArs += ars;
    else debtsArs += ars;
  }
  return { assetsArs, debtsArs, netArs: assetsArs - debtsArs };
}

// ─── Formato ──────────────────────────────────────────────────────────────────

export function fmtArs(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export function fmtUsd(n: number): string {
  return `US$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n)}`;
}

export function fmtMoney(n: number, currency: Currency): string {
  return currency === "USD" ? fmtUsd(n) : fmtArs(n);
}

/** "1.250.000,5" → 1250000.5 · devuelve NaN si no es un número. */
export function parseMoney(text: string): number {
  const clean = text.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (clean === "") return NaN;
  return Number(clean);
}

/** Da formato es-AR mientras se escribe: "1250000" → "1.250.000". */
export function formatMoneyInput(text: string): string {
  const cleaned = text.replace(/[^\d,]/g, "");
  const [intRaw, ...rest] = cleaned.split(",");
  const int = intRaw.replace(/^0+(?=\d)/, "");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (rest.length === 0) return grouped;
  return `${grouped || "0"},${rest.join("").slice(0, 2)}`;
}

export function numberToInput(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  return formatMoneyInput(String(round2(n)).replace(".", ","));
}
