import type { AppNotifications, CardsOverview, HomeSummary, PendingPayment, WealthOverview } from "../types";

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
}

export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`No implementado todavía en modo api: ${what}`);
  }
}
