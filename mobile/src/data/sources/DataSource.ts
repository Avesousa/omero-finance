import type { LoanDTO } from "../../domain";
import type {
  AppNotifications,
  CardsOverview,
  DebtsOverview,
  HomeSummary,
  NewLoanInput,
  PendingPayment,
  WealthOverview,
} from "../types";

/** Contrato de datos de la app. Implementaciones: `mock` (default) y `api`. */
export interface DataSource {
  /** Resumen del mes (`period` 'YYYY-MM'; por defecto el actual). */
  getHome(period?: string): Promise<HomeSummary>;
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
}

export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`No implementado todavía en modo api: ${what}`);
  }
}
