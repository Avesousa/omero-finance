import type { AppNotifications, HomeSummary, PendingPayment } from "../types";

/** Contrato de datos de la app. Implementaciones: `mock` (default) y `api`. */
export interface DataSource {
  /** Resumen del mes (`period` 'YYYY-MM'; por defecto el actual). */
  getHome(period?: string): Promise<HomeSummary>;
  getPendingPayments(): Promise<PendingPayment[]>;
  getNotifications(): Promise<AppNotifications>;
  /** Confirma un pago por confirmar (opcionalmente completando el monto). */
  confirmPayment(id: string, amount?: number): Promise<void>;
}

export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`No implementado todavía en modo api: ${what}`);
  }
}
