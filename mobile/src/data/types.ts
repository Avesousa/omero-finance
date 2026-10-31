import type { BudgetRow, Currency, Frequency, LoanDirection, LoanDTO, LoanMode, Summary } from "../domain";

export type { Currency, LoanDirection, LoanDTO, LoanMode, MonthPlan } from "../domain";

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

export type NoticeKind = "due" | "weekClosed" | "debtDown" | "budgetNear" | "budgetOverCategory";

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

/** Tipo de movimiento que se carga a mano o por voz. */
export type EntryKind = "INCOME" | "EXPENSE";

/** Categoría de ingreso o de gasto del hogar (para el formulario y para la voz). */
export interface Category {
  id: string;
  name: string;
}

/** @deprecated Usar `Category`. */
export type IncomeCategory = Category;

/** Lo que carga el formulario de ingreso o gasto. Igual al body de `POST /api/plan/entries`. */
export interface NewEntryInput {
  kind: EntryKind;
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
  fixed: { frequency: Frequency; /** 0 = domingo … 6 = sábado; solo semanal. */ weekday?: number | null; /** Día del mes (1–31) en que vence. */ dueDay?: number | null } | null;
}

/**
 * Cambios a un movimiento del mes (`PATCH /api/plan/entries/[id]`). `amount` es el total del mes de ese movimiento
 * (para un fijo no mensual: monto por vez × veces en el mes, ver `monthlyAmount`).
 * `applyToRule` guarda también en la regla (próximos meses) y es lo único que habilita `frequency`, `weekday` y `dueDay`.
 */
export type EntryPatch = Partial<{
  name: string;
  amount: number;
  currency: Currency;
  categoryId: string | null;
  isDone: boolean;
  note: string | null;
}> & {
  applyToRule?: boolean;
  frequency?: Frequency;
  weekday?: number | null;
  dueDay?: number | null;
};

/** Un gasto fijo del mes (movimiento real o proyectado si el mes no empezó). */
export interface FixedItem {
  /** null si es proyectado (el mes todavía no empezó): no se puede editar. */
  entryId: string | null;
  /** Clave estable de la fila (id de la regla; o de la entry si no hay regla). */
  recurringId: string | null;
  name: string;
  /** Total del mes, en `currency`. */
  amount: number;
  currency: Currency;
  /** Monto por vez (por semana, quincena o mes). */
  unitAmount: number;
  frequency: Frequency;
  weekday: number | null;
  dueDay: number | null;
  /** 'YYYY-MM-DD' del próximo vencimiento (mensual: el día pactado; semanal: la próxima vez que cae ese día; sin dato: null). */
  dueDate: string | null;
  isDone: boolean;
  categoryId: string | null;
}

export interface FixedGroup {
  categoryId: string | null;
  /** Nombre de la categoría; "" si no tiene (la UI pone el texto). */
  name: string;
  /** En ARS. */
  total: number;
  items: FixedItem[];
}

export interface FixedExpensesView {
  /** El mes no empezó: son los fijos propuestos (solo lectura). */
  projected: boolean;
  /** Totales en ARS. */
  total: number;
  paid: number;
  pending: number;
  count: number;
  paidCount: number;
  /** El próximo fijo sin pagar con vencimiento desde hoy. */
  nextDue: { name: string; date: string; days: number } | null;
  groups: FixedGroup[];
}

/** Entrada de voz: el audio grabado (URI local) o texto escrito. */
export type VoiceInput = { audioUri: string; mimeType: string; durationMs?: number } | { text: string };

/** Error que la app le avisa al admin (`POST /api/plan/errors`). */
export interface ErrorReport {
  source: "voice" | "app";
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

// ───────────── Presupuesto del mes ─────────────

/** Una línea del presupuesto: `categoryId` + tope. Monto 0 quita la línea (igual a `PUT /api/plan/budget`). */
export interface BudgetItem {
  categoryId: string;
  amount: number;
}

/** Entrada de Inicio que no sale del plan: saludo, pendientes de Apple Pay e historia del nido. */
export interface HomeExtras {
  greetingName: string;
  pendingConfirmCount: number;
  story: HomeSummary["story"];
}

/** Dónde se muestra la línea: ahorro primero, lo que sale solo, o los gastos con tope del mes. */
export type BudgetGroup = "savings" | "committed" | "variable";

export interface BudgetLine extends BudgetRow {
  group: BudgetGroup;
  /** gastado / tope (0 si no hay tope). Puede pasar de 1: la barra se recorta en la pantalla. */
  ratio: number;
  /** Comprometido: cuántos fijos / cuotas / tarjetas ya se pagaron de cuántos hay. Null en el resto. */
  fixed: { paid: number; total: number } | null;
}

export interface BudgetView {
  /** El mes todavía no empezó: ingresos y fijos son los que se repiten cada mes (`projectedPlan`). */
  projected: boolean;
  summary: Summary;
  /** Libre del mes (lo que el presupuesto todavía no tiene destino). Negativo = asignaste de más. */
  free: number;
  income: number;
  /** Suma de todos los topes del mes. */
  assigned: number;
  /** Línea de "Ahorro e inversión" (aunque no tenga tope todavía). Null solo si el hogar no tiene esa categoría. */
  savings: BudgetLine | null;
  committed: BudgetLine[];
  variable: BudgetLine[];
  /** Categorías de gasto editables sin tope ni línea (para "Agregar tope"). */
  withoutBudget: { categoryId: string; name: string }[];
  /** Hay presupuesto anterior y este mes todavía no tiene ninguno. */
  canCopyPrevious: boolean;
  previousPeriod: string | null;
  /** Variables y comprometidas (no el ahorro) cerca del tope o pasadas. */
  counts: { near: number; over: number };
  /** Gastos del mes con tope vs gastado (solo variables), para la barra del resumen de Inicio. */
  variableTotals: { budget: number; actual: number };
}

/** Para el asistente: qué se puso el mes anterior y cuánto se lleva gastado en la categoría. */
export interface SuggestedBudget {
  previous: number | null;
  spentNow: number;
}

/** Una categoría que recorre el asistente de presupuesto, con lo que se sabe de ella. */
export interface AssistantTarget {
  categoryId: string;
  name: string;
  /** `savings` = "Ahorro e inversión" (siempre primero). */
  kind: "savings" | "category";
  /** Tope del mes anterior (null si no había). */
  previous: number | null;
  /** Lo gastado en el mes hasta ahora. */
  spentNow: number;
  /** Tope actual del mes (0 si no tiene). */
  current: number;
}
