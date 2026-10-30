import type { DataSource } from "./DataSource";
import type { AppNotifications, HomeSummary, PendingPayment } from "../types";

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

export const mockSource: DataSource = {
  getHome: async () => wait({ ...home, pendingConfirmCount: pending.length }),
  getPendingPayments: async () => wait([...pending]),
  getNotifications: async () => wait({ pending: [...pending], notices: [...notices] }),
  confirmPayment: async (id) => {
    pending = pending.filter((p) => p.id !== id);
    await wait(undefined);
  },
};
