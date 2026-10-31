import type { LoanDTO, MonthPlan, VoiceOutcome } from "../../domain";
import type {
  AppNotifications,
  BudgetItem,
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
  WealthOverview,
} from "../types";

/** Contrato de datos de la app. Implementaciones: `mock` (default) y `api`. */
export interface DataSource {
  /** Resumen del mes (`period` 'YYYY-MM'; por defecto el actual). */
  getHome(period?: string): Promise<HomeSummary>;
  /** Todo lo del mes (lo mismo que `GET /api/plan/data`): de acá salen Inicio y el presupuesto. */
  getPlan(period?: string): Promise<MonthPlan>;
  /** Guarda topes del presupuesto del mes (`PUT /api/plan/budget`); monto 0 quita la línea. */
  saveBudget(period: string, items: BudgetItem[]): Promise<void>;
  getPendingPayments(): Promise<PendingPayment[]>;
  getNotifications(): Promise<AppNotifications>;
  /** Confirma un pago por confirmar (opcionalmente completando el monto). */
  confirmPayment(id: string, amount?: number): Promise<void>;
  /** Tarjetas, resúmenes y compras en cuotas (`period` 'YYYY-MM'; por defecto el actual). */
  getCards(period?: string): Promise<CardsOverview>;
  /** Patrimonio: activos, deudas e historial. */
  getWealth(period?: string): Promise<WealthOverview>;
  /** Marca como pagado el resumen de una tarjeta en un período. */
  markStatementPaid(cardId: string, period: string): Promise<void>;
  /** Deudas: préstamos (debo / me deben) y la deuda de tarjetas del período. */
  getDebts(period?: string): Promise<DebtsOverview>;
  /** Marca pagada (o cobrada) la cuota del período; si todavía no existe la crea con la cuota propuesta. */
  markLoanPaid(loanId: string, period: string): Promise<void>;
  /** Agrega un préstamo y lo devuelve ya con id. */
  addLoan(input: NewLoanInput): Promise<LoanDTO>;
  /** Interpreta lo dicho (audio o texto). No guarda nada. Lanza `AppError`. */
  interpretVoice(input: VoiceInput): Promise<VoiceOutcome>;
  /** Categorías (no archivadas) del hogar, de ingreso o de gasto. */
  getCategories(kind: EntryKind): Promise<Category[]>;
  /** Agrega un ingreso o un gasto (`input.kind`). */
  addEntry(input: NewEntryInput): Promise<void>;
  /** Registra un error para el admin. */
  reportError(report: ErrorReport): Promise<void>;
}

export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`No implementado todavía en modo api: ${what}`);
  }
}
