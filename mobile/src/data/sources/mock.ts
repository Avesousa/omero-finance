import type { DataSource } from "./DataSource";
import {
  loanDueDate,
  loanKind,
  monthlyAmount,
  occurrencesInPeriod,
  round2,
  proposeLoanPayment,
  TDC_KEY,
  toArs,
  type BudgetDTO,
  type CardDTO,
  type CategoryDTO,
  type EntryDTO,
  type LoanDTO,
  type MonthPlan,
  type PurchaseDTO,
  type RecurringDTO,
  type StatementDTO,
} from "../../domain/index.ts";
import { AppError } from "../errors.ts";
import { MOCK_AUDIO_TEXT, mockOutcome } from "./mockVoice.ts";
import { budgetNotices, budgetView } from "../budget.ts";
import { homeFromPlan } from "../plan.ts";
import { cardsDebt, derivedWealthItems, equityRatio, nestStage, previewLoan, wealthTotals } from "../selectors.ts";
import type {
  AppNotifications,
  BudgetItem,
  Card,
  CardPurchase,
  CardsOverview,
  DebtsOverview,
  ErrorReport,
  HomeSummary,
  Category,
  EntryKind,
  EntryPatch,
  NewEntryInput,
  NewLoanInput,
  PendingPayment,
  VoiceInput,
  WealthGoal,
  WealthItem,
  WealthOverview,
} from "../types";

const LATENCY_MS = 300;
const wait = <T,>(value: T): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));

// Datos del lienzo de diseño (ficticios): Noviembre 2026, hoy 3 de noviembre.
const GREETING_NAME = "Avelino";

// Estado en memoria: confirmar un pago lo saca de la lista y baja el contador.
let pending: PendingPayment[] = [
  { id: "p1", merchant: "Café Martínez", amount: 4_800, currency: "ARS", card: "Visa Galicia", occurredAt: "2026-11-03T09:12" },
  { id: "p2", merchant: "YPF", amount: null, currency: "ARS", card: "Visa Galicia", occurredAt: "2026-11-02T19:40" },
];

const notices: AppNotifications["notices"] = [
  { id: "n1", kind: "due", params: { name: "Expensas", date: "2026-11-10", amount: 529_363 }, at: "2026-11-03T08:00", read: false },
  { id: "n2", kind: "weekClosed", params: { n: 1 }, at: "2026-11-02T21:00", read: false },
  { id: "n3", kind: "debtDown", params: { amount: 176_772 }, at: "2026-11-01T10:30", read: true },
];

const CURRENT_PERIOD = "2026-11";
const TODAY = "2026-11-03";
const USD_RATE = 1450;

// Categorías de gasto = las de la web (`DEFAULT_EXPENSE` en server.ts) + la de tarjetas (systemKey TDC).
const EXPENSE_NAMES: [id: string, name: string][] = [
  ["exp-alquiler", "Alquiler"], ["exp-expensas", "Expensas"], ["exp-servicios", "Servicios"],
  ["exp-supermercado", "Supermercado"], ["exp-transporte", "Transporte"], ["exp-salud", "Salud"],
  ["exp-educacion", "Educación"], ["exp-suscripciones", "Suscripciones"], ["exp-familia", "Familia"],
  ["exp-salidas", "Salidas y ocio"], ["exp-compras", "Compras"], ["exp-deudas", "Deudas y préstamos"],
  ["exp-ahorro", "Ahorro e inversión"], ["exp-otros", "Otros"],
];
const INCOME_NAMES: [id: string, name: string][] = [
  ["ic-sueldo", "Sueldo"], ["ic-freelance", "Freelance"], ["ic-alquileres", "Alquileres"], ["ic-otros", "Otros ingresos"],
];

const planCategories: CategoryDTO[] = [
  ...EXPENSE_NAMES.map(([id, name], i): CategoryDTO => ({ id, kind: "EXPENSE", name, systemKey: null, isArchived: false, sortOrder: i })),
  { id: "exp-tarjetas", kind: "EXPENSE", name: "Tarjetas de crédito", systemKey: TDC_KEY, isArchived: false, sortOrder: 100 },
  ...INCOME_NAMES.map(([id, name], i): CategoryDTO => ({ id, kind: "INCOME", name, systemKey: null, isArchived: false, sortOrder: i })),
];

const categoriesOf = (kind: EntryKind): Category[] =>
  planCategories.filter((c) => c.kind === kind && !c.isArchived && !c.systemKey).map((c) => ({ id: c.id, name: c.name }));

/** Errores que el mock "le avisó al admin" (para probar en desarrollo). */
export const mockErrorReports: ErrorReport[] = [];

const cards: Card[] = [
  { id: "c-visa", name: "Visa Galicia", entity: "Galicia", brand: "VISA", owner: "Avelino" },
  { id: "c-mc", name: "Mastercard BBVA", entity: "BBVA", brand: "MC", owner: "Avelino" },
  { id: "c-amex", name: "Amex Galicia", entity: "Galicia", brand: "AMEX", owner: "Avelino" },
];

// Estado en memoria: marcar pagado muta el resumen.
const statements: CardsOverview["statements"] = [
  { cardId: "c-visa", period: "2026-10", dueDate: "2026-10-10", totalArs: 389_900, minimumArs: null, usdAmount: null, isPaid: true },
  { cardId: "c-mc", period: "2026-10", dueDate: "2026-10-07", totalArs: 176_300, minimumArs: null, usdAmount: null, isPaid: true },
  { cardId: "c-amex", period: "2026-10", dueDate: "2026-10-12", totalArs: 80_000, minimumArs: null, usdAmount: null, isPaid: true },
  { cardId: "c-visa", period: "2026-11", dueDate: "2026-11-10", totalArs: 412_300, minimumArs: 61_000, usdAmount: 42.5, isPaid: false },
  { cardId: "c-mc", period: "2026-11", dueDate: "2026-11-07", totalArs: 198_750, minimumArs: 29_800, usdAmount: null, isPaid: false },
];

const purchases: CardPurchase[] = [
  { id: "b1", cardId: "c-visa", description: "Heladera", categoryName: "Hogar", currency: "ARS", total: 570_000, installments: 6, firstPeriod: "2026-09" },
  { id: "b2", cardId: "c-visa", description: "Pasajes Bariloche", categoryName: "Viajes", currency: "ARS", total: 750_000, installments: 12, firstPeriod: "2026-07" },
  { id: "b3", cardId: "c-mc", description: "Zapatillas", categoryName: "Ropa", currency: "ARS", total: 135_000, installments: 3, firstPeriod: "2026-10" },
  { id: "b4", cardId: "c-amex", description: "Notebook", categoryName: "Tecnología", currency: "ARS", total: 1_320_000, installments: 12, firstPeriod: "2026-03" },
  { id: "b5", cardId: "c-mc", description: "Spotify anual", categoryName: "Suscripciones", currency: "USD", total: 60, installments: 1, firstPeriod: "2026-11" },
];

// Activos manuales. Las deudas (préstamos, tarjetas) y lo que me deben se derivan de `loans` y las tarjetas.
const manualWealthItems: WealthItem[] = [
  { id: "w1", kind: "asset", source: "manual", name: "Caja de ahorro Galicia", currency: "ARS", amount: 1_250_000, previous: 1_100_000 },
  { id: "w2", kind: "asset", source: "manual", name: "Mercado Pago (FCI)", currency: "ARS", amount: 820_000, previous: 760_000 },
  { id: "w3", kind: "asset", source: "manual", name: "Dólares ahorrados", currency: "USD", amount: 3_200, previous: 3_000 },
  { id: "w4", kind: "asset", source: "manual", name: "Plazo fijo", currency: "ARS", amount: 1_500_000, previous: 1_500_000 },
];

let entrySeq = 0;
const pay = (period: string, amount: number, interest: number, isDone: boolean): LoanDTO["payments"][number] => ({
  entryId: `e${++entrySeq}`,
  period,
  amount,
  interest,
  isDone,
});

const baseLoan = {
  categoryId: null,
  interestFrequency: "MONTHLY" as const,
  interestAnnual: false,
  interestTaxPct: null,
  isClosed: false,
  note: null,
  schedule: [] as LoanDTO["schedule"],
  endDate: null,
};

// Estado en memoria: marcar una cuota pagada o agregar un préstamo lo muta.
const loans: LoanDTO[] = [
  {
    ...baseLoan,
    id: "l-galicia", direction: "OWE", mode: "FIXED", name: "Préstamo Galicia", counterpart: "Banco Galicia", currency: "ARS",
    principal: 7_088_235, installments: 48, installmentAmount: 412_000,
    interestRate: 55, interestAnnual: true, interestTaxPct: 21,
    // Saldos según el banco: pisan la cuenta.
    anchors: [{ period: "2026-10", amount: 4_996_772 }, { period: "2026-11", amount: 4_820_000 }],
    startPeriod: "2026-07", createdPeriod: "2026-07", dueDay: 5,
    payments: [
      pay("2026-07", 412_000, 393_100, true),
      pay("2026-08", 412_000, 392_050, true),
      pay("2026-09", 412_000, 390_900, true),
      pay("2026-10", 412_000, 277_115, true),
      pay("2026-11", 412_000, 267_310, false),
    ],
  },
  {
    ...baseLoan,
    id: "l-papa", direction: "OWE", mode: "OPEN", name: "Deuda con Papá", counterpart: "Papá", currency: "ARS",
    principal: 400_000, installments: null, installmentAmount: 50_000, interestRate: null,
    anchors: [], startPeriod: "2026-09", createdPeriod: "2026-09", dueDay: null,
    payments: [pay("2026-09", 50_000, 0, true), pay("2026-10", 50_000, 0, true)],
  },
  {
    ...baseLoan,
    id: "l-juan", direction: "OWED", mode: "FIXED", name: "Préstamo a Juan", counterpart: "Juan", currency: "ARS",
    principal: 400_000, installments: 4, installmentAmount: 100_000, interestRate: null,
    anchors: [], startPeriod: "2026-09", createdPeriod: "2026-09", dueDay: null,
    payments: [pay("2026-09", 100_000, 0, true), pay("2026-10", 100_000, 0, true)],
  },
  {
    ...baseLoan,
    id: "l-martina", direction: "OWED", mode: "OPEN", name: "Martina — pasajes", counterpart: "Martina", currency: "USD",
    principal: 300, installments: null, installmentAmount: null, interestRate: null,
    anchors: [], startPeriod: "2026-10", createdPeriod: "2026-10", dueDay: null,
    payments: [],
  },
];

let loanSeq = 0;

function cloneLoan(l: LoanDTO): LoanDTO {
  return {
    ...l,
    schedule: l.schedule.map((x) => ({ ...x })),
    anchors: l.anchors?.map((x) => ({ ...x })),
    payments: l.payments.map((x) => ({ ...x })),
  };
}

function cardsOverviewAt(period: string): CardsOverview {
  return {
    period,
    today: TODAY,
    usdRate: USD_RATE,
    cards: [...cards],
    statements: statements.map((st) => ({ ...st })),
    purchases: [...purchases],
  };
}

/** Patrimonio del período: activos manuales + deudas y "me deben" derivados de préstamos y tarjetas. */
function wealthItemsAt(period: string): WealthItem[] {
  return [...manualWealthItems, ...derivedWealthItems(loans, cardsOverviewAt(period), period, USD_RATE)];
}

const wealthGoals: WealthGoal[] = [
  { id: "g1", name: "Fondo de emergencia", target: 1_500_000, saved: 450_000, monthly: 175_000, currency: "ARS" },
  { id: "g2", name: "Vacaciones 2027", target: 900_000, saved: 120_000, monthly: null, currency: "ARS" },
];

/** Una sola fuente de verdad: la historia de Inicio sale del mismo nido que Patrimonio. */
function storyFromWealth(): HomeSummary["story"] {
  const { assets, debts } = wealthTotals(wealthItemsAt(CURRENT_PERIOD), USD_RATE);
  const { chapter, progress } = nestStage(equityRatio(assets, debts));
  return { chapter, progress };
}

const wealthHistory: WealthOverview["history"] = [
  { period: "2026-06", netArs: 1_180_000 },
  { period: "2026-07", netArs: 1_620_000 },
  { period: "2026-08", netArs: 2_050_000 },
  { period: "2026-09", netArs: 2_500_000 },
  { period: "2026-10", netArs: 2_850_000 },
];

/** El último mes sale de los ítems (misma cuenta que el hero de Patrimonio). */
function historyAt(): WealthOverview["history"] {
  return [
    ...wealthHistory.map((h) => ({ ...h })),
    { period: CURRENT_PERIOD, netArs: wealthTotals(wealthItemsAt(CURRENT_PERIOD), USD_RATE).net },
  ];
}

// ───────────── Plan del mes (la misma forma que `GET /api/plan/data`) ─────────────

const recurring = (id: string, kind: "INCOME" | "EXPENSE", name: string, categoryId: string, amount: number, dueDay: number | null): RecurringDTO => ({
  id, kind, name, categoryId, targetCategoryId: null, currency: "ARS", amount, frequency: "MONTHLY", weekday: null, dueDay, isActive: true,
});

// Estado en memoria: `addEntry` con "fijo" agrega uno.
const recurrings: RecurringDTO[] = [
  recurring("r-sueldo", "INCOME", "Sueldo", "ic-sueldo", 3_500_000, 1),
  recurring("r-alquiler", "EXPENSE", "Alquiler", "exp-alquiler", 550_000, 5),
  recurring("r-expensas", "EXPENSE", "Expensas", "exp-expensas", 180_000, 10),
  recurring("r-luz", "EXPENSE", "Luz", "exp-servicios", 35_000, 12),
  recurring("r-gas", "EXPENSE", "Gas", "exp-servicios", 22_000, 15),
  recurring("r-internet", "EXPENSE", "Internet", "exp-servicios", 28_000, 18),
  recurring("r-suscripciones", "EXPENSE", "Suscripciones", "exp-suscripciones", 25_000, 20),
  recurring("r-prepaga", "EXPENSE", "Prepaga", "exp-salud", 95_000, 8),
];

const entry = (id: string, kind: "INCOME" | "EXPENSE", name: string, categoryId: string, amount: number, date: string, isDone: boolean, recurringId: string | null): EntryDTO => ({
  id, period: CURRENT_PERIOD, kind, recurringId, name, categoryId, targetCategoryId: null, currency: "ARS", amount, date, isDone,
  note: null, loanId: null, interestAmount: null,
});

// Estado en memoria. Las cuotas de préstamos no están acá: salen de `loans` (ver `loanEntries`).
const planEntries: EntryDTO[] = [
  entry("e-sueldo", "INCOME", "Sueldo", "ic-sueldo", 3_500_000, "2026-11-01", true, "r-sueldo"),
  entry("e-alquiler", "EXPENSE", "Alquiler", "exp-alquiler", 550_000, "2026-11-05", true, "r-alquiler"),
  entry("e-expensas", "EXPENSE", "Expensas", "exp-expensas", 180_000, "2026-11-10", false, "r-expensas"),
  entry("e-luz", "EXPENSE", "Luz", "exp-servicios", 35_000, "2026-11-12", true, "r-luz"),
  entry("e-gas", "EXPENSE", "Gas", "exp-servicios", 22_000, "2026-11-15", true, "r-gas"),
  entry("e-internet", "EXPENSE", "Internet", "exp-servicios", 28_000, "2026-11-18", false, "r-internet"),
  entry("e-suscripciones", "EXPENSE", "Suscripciones", "exp-suscripciones", 25_000, "2026-11-20", false, "r-suscripciones"),
  entry("e-prepaga", "EXPENSE", "Prepaga", "exp-salud", 95_000, "2026-11-08", false, "r-prepaga"),
  entry("e-super", "EXPENSE", "Supermercado", "exp-supermercado", 180_000, "2026-11-02", true, null),
  entry("e-salidas", "EXPENSE", "Salidas y ocio", "exp-salidas", 45_000, "2026-11-01", true, null),
  entry("e-transporte", "EXPENSE", "Transporte", "exp-transporte", 30_000, "2026-11-02", true, null),
  entry("e-compras", "EXPENSE", "Compras", "exp-compras", 20_000, "2026-11-03", true, null),
];
let planSeq = 0;

// Estado en memoria: guardar el presupuesto lo muta. Diciembre arranca sin presupuesto (para probar "copiar").
const budgetsByPeriod: Record<string, BudgetDTO[]> = {
  "2026-10": [
    { categoryId: "exp-ahorro", amount: 400_000 },
    { categoryId: "exp-supermercado", amount: 420_000 },
    { categoryId: "exp-salidas", amount: 150_000 },
    { categoryId: "exp-transporte", amount: 80_000 },
    { categoryId: "exp-compras", amount: 60_000 },
    { categoryId: "exp-otros", amount: 40_000 },
  ],
  "2026-11": [
    { categoryId: "exp-ahorro", amount: 400_000 },
    { categoryId: "exp-supermercado", amount: 450_000 },
    { categoryId: "exp-salidas", amount: 120_000 },
    { categoryId: "exp-transporte", amount: 80_000 },
    { categoryId: "exp-compras", amount: 60_000 },
    { categoryId: "exp-otros", amount: 40_000 },
  ],
};

/** Cuota del mes de cada préstamo: la ya generada o la propuesta (como al iniciar el mes en la web). */
function loanEntries(period: string): EntryDTO[] {
  const out: EntryDTO[] = [];
  for (const loan of loans) {
    const payment = loan.payments.find((p) => p.period === period);
    const proposal = payment ? null : proposeLoanPayment(loan, period);
    if (!payment && !proposal) continue;
    const kind = loanKind(loan.direction);
    out.push({
      id: payment?.entryId ?? `proposal-${loan.id}-${period}`,
      period,
      kind,
      recurringId: null,
      name: loan.name,
      categoryId: kind === "EXPENSE" ? "exp-deudas" : null,
      targetCategoryId: null,
      currency: loan.currency,
      amount: payment?.amount ?? proposal!.amount,
      date: loanDueDate(loan.dueDay, period),
      isDone: payment?.isDone ?? false,
      note: null,
      loanId: loan.id,
      interestAmount: payment?.interest ?? proposal!.interest,
    });
  }
  return out;
}

const toCardDTO = (c: Card): CardDTO => ({ id: c.id, name: c.name, entity: c.entity, cardType: c.brand, ownerName: c.owner });
const toStatementDTO = (st: CardsOverview["statements"][number]): StatementDTO => ({
  id: `st-${st.cardId}-${st.period}`, cardId: st.cardId, period: st.period, dueDate: st.dueDate, totalArs: st.totalArs,
  minimumArs: st.minimumArs, usdAmount: st.usdAmount, payMode: "TOTAL", customAmount: null, isPaid: st.isPaid,
});
const toPurchaseDTO = (p: CardPurchase): PurchaseDTO => ({
  id: p.id, cardId: p.cardId, description: p.description, categoryId: null, currency: p.currency, amount: p.total,
  installments: p.installments, firstPeriod: p.firstPeriod, purchaseDate: null, note: null,
});

function planAt(period: string): MonthPlan {
  const entries = [...planEntries.filter((e) => e.period === period), ...loanEntries(period)].map((e) => ({ ...e }));
  const budgets = (budgetsByPeriod[period] ?? []).map((b) => ({ ...b }));
  // La web solo trae el anterior si el mes no tiene presupuesto; el mock lo trae siempre para poder sugerir "igual que octubre".
  const prior = Object.keys(budgetsByPeriod)
    .filter((p) => p < period && budgetsByPeriod[p].length > 0)
    .sort()
    .pop();
  return {
    period,
    today: TODAY,
    started: planEntries.some((e) => e.period === period),
    usdRate: USD_RATE,
    categories: planCategories.map((c) => ({ ...c })),
    recurrings: recurrings.map((r) => ({ ...r })),
    entries,
    budgets,
    previousBudgets: prior ? budgetsByPeriod[prior].map((b) => ({ ...b })) : [],
    previousBudgetPeriod: prior ?? null,
    cards: cards.map(toCardDTO),
    statements: statements.map(toStatementDTO),
    purchases: purchases.map(toPurchaseDTO),
    loans: loans.map(cloneLoan),
  };
}

export const mockSource: DataSource = {
  interpretVoice: async (input: VoiceInput) => {
    await wait(undefined);
    const text = "text" in input ? input.text : MOCK_AUDIO_TEXT;
    const probe = text.trim().toLowerCase();
    if (probe === "error fatal") {
      mockErrorReports.push({ source: "voice", code: "internal", message: "Error fatal simulado" });
      throw new AppError("Error fatal simulado", { code: "internal", retryable: false, reported: true });
    }
    if (probe === "error") {
      throw new AppError("Error simulado", { code: "provider_unavailable", retryable: true });
    }
    return mockOutcome(text, {
      today: TODAY,
      incomeCategories: categoriesOf("INCOME"),
      expenseCategories: categoriesOf("EXPENSE"),
    });
  },
  getCategories: async (kind: EntryKind) => wait(categoriesOf(kind)),
  addEntry: async (input: NewEntryInput) => {
    // El mock tiene un solo mes con movimientos (noviembre 2026) y el formulario usa la fecha real del teléfono:
    // todo movimiento va a ese mes para poder ver el efecto en Inicio y en el presupuesto.
    planSeq += 1;
    let recurringId: string | null = null;
    if (input.fixed) {
      recurringId = `r-new-${planSeq}`;
      recurrings.push({
        id: recurringId, kind: input.kind, name: input.name, categoryId: input.categoryId, targetCategoryId: null,
        currency: input.currency, amount: input.amount, frequency: input.fixed.frequency,
        weekday: input.fixed.frequency === "WEEKLY" ? (input.fixed.weekday ?? null) : null, dueDay: input.fixed.dueDay ?? null, isActive: true,
      });
    }
    // Como la web: un fijo entra con el total del mes (monto por vez × veces) y sin pagar.
    const rule = recurringId ? recurrings.find((r) => r.id === recurringId) : undefined;
    planEntries.push({
      id: `e-new-${planSeq}`, period: CURRENT_PERIOD, kind: input.kind, recurringId, name: input.name, categoryId: input.categoryId,
      targetCategoryId: null, currency: input.currency,
      amount: rule ? monthlyAmount(rule.amount, rule.frequency, CURRENT_PERIOD, rule.weekday) : input.amount,
      date: rule ? null : (input.date ?? TODAY), isDone: !rule,
      note: input.note, loanId: null, interestAmount: null,
    });
    await wait(undefined);
  },
  updateEntry: async (id: string, patch: EntryPatch) => {
    // Como la web: solo los movimientos cargados (no las propuestas ni las cuotas de préstamos).
    const e = planEntries.find((x) => x.id === id);
    if (!e) throw new AppError("No encontrado", { code: "unknown" });
    if (patch.name !== undefined) e.name = patch.name;
    if (patch.amount !== undefined) e.amount = patch.amount;
    if (patch.currency !== undefined) e.currency = patch.currency;
    if (patch.categoryId !== undefined) e.categoryId = patch.categoryId;
    if (patch.note !== undefined) e.note = patch.note;
    if (patch.date !== undefined) e.date = patch.date;
    if (patch.isDone !== undefined) e.isDone = patch.isDone;
    const rule = patch.applyToRule === true && e.recurringId ? recurrings.find((r) => r.id === e.recurringId) : undefined;
    if (rule) {
      const frequency = patch.frequency ?? rule.frequency;
      const weekday = frequency !== "WEEKLY" ? null : patch.weekday !== undefined ? patch.weekday : rule.weekday;
      rule.name = e.name;
      rule.currency = e.currency;
      rule.categoryId = e.categoryId;
      rule.frequency = frequency;
      rule.weekday = weekday;
      if (patch.dueDay !== undefined) rule.dueDay = patch.dueDay;
      rule.amount = round2(e.amount / occurrencesInPeriod(frequency, e.period, weekday));
    }
    await wait(undefined);
  },
  deleteEntry: async (id: string, scope: "month" | "rule") => {
    const i = planEntries.findIndex((x) => x.id === id);
    if (i < 0) throw new AppError("No encontrado", { code: "unknown" });
    const [removed] = planEntries.splice(i, 1);
    if (scope === "rule" && removed.recurringId) {
      const rule = recurrings.find((r) => r.id === removed.recurringId);
      if (rule) rule.isActive = false;
    }
    await wait(undefined);
  },
  reportError: async (report: ErrorReport) => {
    mockErrorReports.push(report);
    await wait(undefined);
  },
  getHome: async (period = CURRENT_PERIOD) =>
    wait(homeFromPlan(planAt(period), { greetingName: GREETING_NAME, pendingConfirmCount: pending.length, story: storyFromWealth() })),
  getPlan: async (period = CURRENT_PERIOD) => wait(planAt(period)),
  saveBudget: async (period: string, items: BudgetItem[]) => {
    const list = (budgetsByPeriod[period] ??= []);
    for (const item of items) {
      const i = list.findIndex((b) => b.categoryId === item.categoryId);
      if (item.amount > 0) {
        if (i >= 0) list[i].amount = item.amount;
        else list.push({ categoryId: item.categoryId, amount: item.amount });
      } else if (i >= 0) {
        list.splice(i, 1);
      }
    }
    await wait(undefined);
  },
  getPendingPayments: async () => wait([...pending]),
  getNotifications: async () => {
    const plan = planAt(CURRENT_PERIOD);
    return wait({ pending: [...pending], notices: [...budgetNotices(budgetView(plan), plan.today), ...notices] });
  },
  confirmPayment: async (id) => {
    pending = pending.filter((p) => p.id !== id);
    await wait(undefined);
  },
  getCards: async (period = CURRENT_PERIOD) => wait<CardsOverview>(cardsOverviewAt(period)),
  getWealth: async (period = CURRENT_PERIOD) =>
    wait<WealthOverview>({
      period,
      usdRate: USD_RATE,
      items: wealthItemsAt(period).map((i) => ({ ...i })),
      goals: wealthGoals.map((g) => ({ ...g })),
      history: historyAt(),
    }),
  markStatementPaid: async (cardId, period) => {
    const st = statements.find((x) => x.cardId === cardId && x.period === period);
    if (st) st.isPaid = true;
    await wait(undefined);
  },
  getDebts: async (period = CURRENT_PERIOD) =>
    wait<DebtsOverview>({
      period,
      today: TODAY,
      usdRate: USD_RATE,
      loans: loans.map(cloneLoan),
      cards: cardsDebt(cardsOverviewAt(period), period),
    }),
  markLoanPaid: async (loanId, period) => {
    const loan = loans.find((l) => l.id === loanId);
    if (loan) {
      const existing = loan.payments.find((p) => p.period === period);
      if (existing) {
        existing.isDone = true;
      } else {
        const proposal = proposeLoanPayment(loan, period);
        if (proposal) {
          loan.payments.push(pay(period, proposal.amount, proposal.interest, true));
          loan.payments.sort((a, b) => a.period.localeCompare(b.period));
        }
      }
    }
    await wait(undefined);
  },
  addLoan: async (input: NewLoanInput) => {
    loanSeq += 1;
    const loan: LoanDTO = {
      ...baseLoan,
      id: `l-new-${loanSeq}`,
      direction: input.direction,
      mode: input.mode,
      name: input.name,
      counterpart: input.counterpart,
      currency: input.currency,
      principal: input.principal,
      installments: input.mode === "FIXED" ? input.installments : null,
      installmentAmount: input.installmentAmount ?? (input.mode === "FIXED" ? previewLoan(input).installment : null),
      interestRate: input.interestRate,
      interestAnnual: input.interestAnnual,
      interestTaxPct: input.interestTaxPct,
      anchors: [],
      startPeriod: input.startPeriod,
      createdPeriod: CURRENT_PERIOD < input.startPeriod ? CURRENT_PERIOD : input.startPeriod,
      dueDay: input.dueDay,
      endDate: input.endDate,
      payments: [],
    };
    loans.push(loan);
    return wait(cloneLoan(loan));
  },
};
