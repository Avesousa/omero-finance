import type { Currency, Frequency, LoanDirection, LoanDTO, LoanMode } from "../domain";

export type { Currency, LoanDirection, LoanDTO, LoanMode } from "../domain";

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

// ───────────── Deudas y préstamos ─────────────

/** Deuda de tarjetas del período (lo que falta pagar de los resúmenes + lo estimado por cuotas). */
export interface CardsDebt {
  /** Tarjetas con algo por pagar. */
  count: number;
  debtArs: number;
  /** Vencimiento más cercano de un resumen sin pagar, 'YYYY-MM-DD'. */
  nextDue: string | null;
}

export interface DebtsOverview {
  period: string;
  today: string;
  usdRate: number;
  loans: LoanDTO[];
  cards: CardsDebt;
}

/** Los campos editables de un préstamo (lo que carga el formulario "Nueva deuda"). */
export interface NewLoanInput {
  direction: LoanDirection;
  mode: Extract<LoanMode, "FIXED" | "OPEN">;
  name: string;
  counterpart: string | null;
  currency: Currency;
  principal: number;
  /** FIXED: cantidad de cuotas. OPEN: null. */
  installments: number | null;
  /** FIXED: cuota del primer mes (null = la calcula el sistema francés). OPEN: pago sugerido por mes. */
  installmentAmount: number | null;
  /** % (mensual, o anual si `interestAnnual`). */
  interestRate: number | null;
  interestAnnual: boolean;
  /** IVA sobre el interés, en % (ej. 21). */
  interestTaxPct: number | null;
  /** Primer mes, 'YYYY-MM'. */
  startPeriod: string;
  dueDay: number | null;
  endDate: string | null;
}

/** Cuota del mes de un préstamo, en su moneda. */
export interface LoanMonthPayment {
  amount: number;
  interest: number;
  /** 'YYYY-MM-DD' o null si no tiene día de vencimiento. */
  dueDate: string | null;
  isDone: boolean;
}

/** Un préstamo listo para mostrar en el período. Importes en la moneda del préstamo salvo `capitalArs`. */
export interface LoanRow {
  id: string;
  direction: LoanDirection;
  mode: LoanMode;
  name: string;
  counterpart: string | null;
  currency: Currency;
  /** Saldo de capital al cierre del período. */
  capital: number;
  capitalArs: number;
  /** 0..1. FIXED: cuotas pagas / total. OPEN: 1 − capital / principal. */
  paidRatio: number;
  /** Número de la cuota del mes (FIXED/SCHEDULE) o null. */
  installmentNumber: number | null;
  installmentsTotal: number | null;
  monthPayment: LoanMonthPayment | null;
  /** Tasa: `pct` tal cargado, anual o mensual, y si lleva IVA. Null si no tiene. */
  rate: { pct: number; annual: boolean; withTax: boolean } | null;
  finished: boolean;
}

export interface DebtsTotals {
  /** Capital de préstamos OWE + deuda de tarjetas. */
  oweArs: number;
  /** Capital de préstamos OWED. */
  owedArs: number;
  /** Lo que falta pagar este mes: cuotas OWE sin pagar + tarjetas. */
  monthToPayArs: number;
  /** Lo que falta cobrar este mes: cuotas OWED sin cobrar. */
  monthToCollectArs: number;
  /** Cuotas OWE ya pagadas este mes (sin tarjetas). */
  paidThisMonthArs: number;
}

export interface LoanPreview {
  /** Cuota estimada (FIXED: sistema francés · OPEN: el pago sugerido), null si no se puede calcular. */
  installment: number | null;
  totalToPay: number | null;
  totalInterest: number | null;
  /** Mes de la última cuota, 'YYYY-MM'. */
  endPeriod: string | null;
}

/** Categoría de ingreso del hogar (para el formulario de ingreso y para la voz). */
export interface IncomeCategory {
  id: string;
  name: string;
}

/** Lo que carga el formulario de ingreso. Igual al body de `POST /api/plan/entries` con `kind: "INCOME"`. */
export interface NewIncomeInput {
  /** Mes al que pertenece, 'YYYY-MM'. */
  period: string;
  name: string;
  amount: number;
  currency: Currency;
  categoryId: string | null;
  /** 'YYYY-MM-DD' o null (= hoy). */
  date: string | null;
  note: string | null;
  /** Si es fijo, `amount` es el monto por vez. */
  fixed: { frequency: Frequency } | null;
}

/** Entrada de voz: el audio grabado (URI local) o texto escrito. */
export type VoiceInput = { audioUri: string; mimeType: string } | { text: string };

/** Error que la app le avisa al admin (`POST /api/plan/errors`). */
export interface ErrorReport {
  source: "voice" | "app";
  code: string;
  message: string;
  context?: Record<string, unknown>;
}
