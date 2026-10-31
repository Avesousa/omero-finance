import type { DataSource } from "./DataSource";
import { proposeLoanPayment, toArs, type LoanDTO } from "../../domain/index.ts";
import { AppError } from "../errors.ts";
import { MOCK_AUDIO_TEXT, mockOutcome } from "./mockVoice.ts";
import { cardsDebt, derivedWealthItems, equityRatio, nestStage, previewLoan, wealthTotals } from "../selectors.ts";
import type {
  AppNotifications,
  Card,
  CardPurchase,
  CardsOverview,
  DebtsOverview,
  ErrorReport,
  HomeSummary,
  Category,
  EntryKind,
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

// Datos del lienzo de diseño (ficticios): Noviembre 2026, quedan 27 días.
const home: Omit<HomeSummary, "pendingConfirmCount" | "story"> = {
  greetingName: "Avelino",
  period: "2026-11",
  today: "2026-11-03",
  daysLeft: 27,
  income: 3_500_000,
  available: 2_675_000,
  free: 1_103_400,
  pendingToPay: 1_474_000,
  spendingByCategory: [
    { id: "rent", labelKey: "spending.categories.rent", amount: 550_000 },
    { id: "groceries", labelKey: "spending.categories.groceries", amount: 180_000 },
    { id: "outings", labelKey: "spending.categories.outings", amount: 45_000 },
    { id: "transport", labelKey: "spending.categories.transport", amount: 30_000 },
    { id: "other", labelKey: "spending.categories.other", amount: 20_000 },
  ],
  fixed: { paid: 3, total: 7, paidAmount: 1_126_000, totalAmount: 2_600_000 },
};

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
const USD_RATE = 1450;

const incomeCategories: Category[] = [
  { id: "ic-sueldo", name: "Sueldo" },
  { id: "ic-freelance", name: "Freelance" },
  { id: "ic-alquileres", name: "Alquileres" },
  { id: "ic-otros", name: "Otros ingresos" },
];

const expenseCategories: Category[] = [
  { id: "exp-supermercado", name: "Supermercado" },
  { id: "exp-transporte", name: "Transporte" },
  { id: "exp-salidas", name: "Salidas y ocio" },
  { id: "exp-servicios", name: "Servicios" },
  { id: "exp-otros", name: "Otros" },
];

/** Tramo de "En qué se va el mes" al que suma cada categoría de gasto del mock; el resto va a Otros. */
const SPENDING_BUCKET: Record<string, string> = {
  "exp-supermercado": "groceries",
  "exp-transporte": "transport",
  "exp-salidas": "outings",
};

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
    today: home.today,
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
      today: home.today,
      incomeCategories: incomeCategories.map((c) => ({ ...c })),
      expenseCategories: expenseCategories.map((c) => ({ ...c })),
    });
  },
  getCategories: async (kind: EntryKind) =>
    wait((kind === "INCOME" ? incomeCategories : expenseCategories).map((c) => ({ ...c }))),
  addEntry: async (input: NewEntryInput) => {
    // El mock tiene un solo mes (noviembre 2026) y el formulario usa la fecha real del teléfono:
    // todo movimiento suma a Inicio para poder ver el efecto. En pesos (los dólares se convierten).
    const ars = toArs(input.amount, input.currency, USD_RATE);
    if (input.kind === "INCOME") {
      home.income += ars;
      home.available += ars;
      home.free += ars;
    } else {
      home.available -= ars;
      home.free -= ars;
      const bucketId = (input.categoryId && SPENDING_BUCKET[input.categoryId]) || "other";
      const bucket = home.spendingByCategory.find((c) => c.id === bucketId);
      if (bucket) bucket.amount += ars;
    }
    await wait(undefined);
  },
  reportError: async (report: ErrorReport) => {
    mockErrorReports.push(report);
    await wait(undefined);
  },
  getHome: async () => wait({ ...home, pendingConfirmCount: pending.length, story: storyFromWealth() }),
  getPendingPayments: async () => wait([...pending]),
  getNotifications: async () => wait({ pending: [...pending], notices: [...notices] }),
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
      today: home.today,
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
