import type { DataSource } from "./DataSource";
import { wealthTotals } from "../selectors";
import type {
  AppNotifications,
  Card,
  CardPurchase,
  CardsOverview,
  HomeSummary,
  PendingPayment,
  WealthItem,
  WealthOverview,
} from "../types";

const LATENCY_MS = 300;
const wait = <T,>(value: T): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));

// Datos del lienzo de diseño (ficticios): Noviembre 2026, quedan 27 días.
const home: Omit<HomeSummary, "pendingConfirmCount"> = {
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
  story: { chapter: 1, progress: 0.4 },
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

const wealthItems: WealthItem[] = [
  { id: "w1", kind: "asset", source: "manual", name: "Caja de ahorro Galicia", currency: "ARS", amount: 1_250_000, previous: 1_100_000 },
  { id: "w2", kind: "asset", source: "manual", name: "Mercado Pago (FCI)", currency: "ARS", amount: 820_000, previous: 760_000 },
  { id: "w3", kind: "asset", source: "manual", name: "Dólares ahorrados", currency: "USD", amount: 3_200, previous: 3_000 },
  { id: "w4", kind: "asset", source: "manual", name: "Plazo fijo", currency: "ARS", amount: 1_500_000, previous: 1_500_000 },
  {
    id: "w5", kind: "debt", source: "loan", name: "Préstamo Galicia", currency: "ARS", amount: 4_820_000, previous: 4_996_772,
    loan: { paidRatio: 0.32, installmentsLeft: 34 },
  },
  { id: "w6", kind: "debt", source: "card", name: "Tarjetas", currency: "ARS", amount: 611_050, previous: 646_200 },
  { id: "w7", kind: "debt", source: "manual", name: "Deuda con Papá", currency: "ARS", amount: 300_000, previous: 350_000 },
];

const wealthHistory: WealthOverview["history"] = [
  { period: "2026-06", netArs: 1_180_000 },
  { period: "2026-07", netArs: 1_420_000 },
  { period: "2026-08", netArs: 1_650_000 },
  { period: "2026-09", netArs: 1_910_000 },
  { period: "2026-10", netArs: 2_230_000 },
  { period: CURRENT_PERIOD, netArs: wealthTotals(wealthItems, USD_RATE).net },
];

export const mockSource: DataSource = {
  getHome: async () => wait({ ...home, pendingConfirmCount: pending.length }),
  getPendingPayments: async () => wait([...pending]),
  getNotifications: async () => wait({ pending: [...pending], notices: [...notices] }),
  confirmPayment: async (id) => {
    pending = pending.filter((p) => p.id !== id);
    await wait(undefined);
  },
  getCards: async (period = CURRENT_PERIOD) =>
    wait<CardsOverview>({
      period,
      today: home.today,
      usdRate: USD_RATE,
      cards: [...cards],
      statements: statements.map((st) => ({ ...st })),
      purchases: [...purchases],
    }),
  getWealth: async (period = CURRENT_PERIOD) =>
    wait<WealthOverview>({
      period,
      usdRate: USD_RATE,
      items: wealthItems.map((i) => ({ ...i })),
      history: wealthHistory.map((h) => ({ ...h })),
    }),
  markStatementPaid: async (cardId, period) => {
    const st = statements.find((x) => x.cardId === cardId && x.period === period);
    if (st) st.isPaid = true;
    await wait(undefined);
  },
};
