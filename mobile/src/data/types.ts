/** Un tramo del gráfico "En qué se va el mes". Usar `labelKey` (i18n) o, si viene del servidor, `name`. */
export interface SpendingCategory {
  id: string;
  /** Clave i18n del namespace home, ej. "spending.categories.rent". */
  labelKey?: string;
  /** Nombre literal (categorías creadas por el usuario). Tiene prioridad si no hay labelKey. */
  name?: string;
  amount: number;
}

export interface FixedProgress {
  paid: number;
  total: number;
  paidAmount: number;
  totalAmount: number;
}

export interface HomeSummary {
  greetingName: string;
  /** Mes en curso, 'YYYY-MM'. */
  period: string;
  /** Fecha de referencia, 'YYYY-MM-DD'. */
  today: string;
  daysLeft: number;
  income: number;
  /** Lo que queda del mes descontando lo ya pagado. */
  available: number;
  /** Lo que queda de verdad libre (después de lo reservado para pagos pendientes). */
  free: number;
  pendingToPay: number;
  spendingByCategory: SpendingCategory[];
  fixed: FixedProgress;
  /** Pagos de Apple Pay por confirmar. */
  pendingConfirmCount: number;
  /** Capítulo de la historia de la mascota (1..3) y avance 0..1. El título sale de i18n de la mascota. */
  story: { chapter: number; progress: number };
}

/** Pago detectado (Apple Pay) que espera confirmación. `amount: null` = sin monto. */
export interface PendingPayment {
  id: string;
  merchant: string;
  amount: number | null;
  currency: string;
  /** Tarjeta del wallet, ej. "Visa Galicia". */
  card: string | null;
  /** 'YYYY-MM-DDTHH:mm' en hora local. */
  occurredAt: string;
}

export type NoticeKind = "due" | "weekClosed" | "debtDown";

/**
 * Aviso informativo. El texto sale de i18n: `notifications:notices.<kind>` con `params`
 * (name, date ISO 'YYYY-MM-DD' → formatear con formatDate, amount número → formatMoney, n).
 */
export interface AppNotice {
  id: string;
  kind: NoticeKind;
  params: { name?: string; date?: string; amount?: number; n?: number };
  /** 'YYYY-MM-DDTHH:mm' */
  at: string;
  read: boolean;
}

export interface AppNotifications {
  pending: PendingPayment[];
  notices: AppNotice[];
}

export type Currency = "ARS" | "USD";
export type CardBrand = "VISA" | "MC" | "AMEX";

export interface CardStatement {
  /** 'YYYY-MM' */
  period: string;
  /** 'YYYY-MM-DD' */
  dueDate: string | null;
  totalArs: number;
  minimumArs: number | null;
  usdAmount: number | null;
  isPaid: boolean;
}

export interface Card {
  id: string;
  name: string;
  entity: string | null;
  brand: CardBrand | null;
  owner: string | null;
}

/** Compra en cuotas: se reparte en `installments` cuotas iguales desde `firstPeriod`. */
export interface CardPurchase {
  id: string;
  cardId: string;
  description: string;
  categoryName: string | null;
  currency: Currency;
  total: number;
  installments: number;
  firstPeriod: string;
}

export interface CardsOverview {
  period: string;
  today: string;
  usdRate: number;
  cards: Card[];
  /** Resúmenes cargados (cualquier mes). */
  statements: (CardStatement & { cardId: string })[];
  purchases: CardPurchase[];
}

export type WealthKind = "asset" | "debt";
export type WealthSource = "manual" | "loan" | "card";

export interface WealthItem {
  id: string;
  kind: WealthKind;
  source: WealthSource;
  name: string;
  currency: Currency;
  /** Saldo al cierre del mes (en su moneda). */
  amount: number;
  /** Saldo del mes anterior (para el delta), null si no había. */
  previous: number | null;
  /** Solo préstamos: avance pagado 0..1 y cuotas que faltan. */
  loan?: { paidRatio: number; installmentsLeft: number | null };
}

/** Meta de ahorro. `monthly: null` = sin aporte definido. */
export interface WealthGoal {
  id: string;
  name: string;
  target: number;
  saved: number;
  monthly: number | null;
  currency: Currency;
}

/** Capítulo de la historia / etapa del nido de la mascota. */
export type NestChapter = 1 | 2 | 3;

export interface WealthOverview {
  period: string;
  usdRate: number;
  items: WealthItem[];
  goals: WealthGoal[];
  /** Patrimonio neto en ARS de los últimos 6 meses, el último = `period`. */
  history: { period: string; netArs: number }[];
}
