import { api } from "../../../lib/api";
import type { InboxItemDTO } from "../../../lib/types";
import { NotImplementedError, type DataSource } from "./DataSource";
import type { PendingPayment } from "../types";

function toPending(item: InboxItemDTO): PendingPayment {
  return {
    id: item.id,
    merchant: item.merchant ?? "",
    amount: item.amount,
    currency: item.currency,
    card: item.walletCard,
    occurredAt: item.occurredAt.slice(0, 16),
  };
}

/**
 * Fuente real. Solo los pagos por confirmar existen hoy en el backend (`/api/plan/inbox`);
 * el resto lanza NotImplementedError hasta que se conecte.
 */
export const apiSource: DataSource = {
  getHome: async () => {
    throw new NotImplementedError("getHome");
  },
  getPendingPayments: async () => {
    const res = await api<{ items: InboxItemDTO[] }>("GET", "/api/plan/inbox");
    return res.items.map(toPending);
  },
  getNotifications: async () => {
    const res = await api<{ items: InboxItemDTO[] }>("GET", "/api/plan/inbox");
    return { pending: res.items.map(toPending), notices: [] };
  },
  confirmPayment: async () => {
    throw new NotImplementedError("confirmPayment");
  },
  getCards: async () => {
    throw new NotImplementedError("getCards");
  },
  getWealth: async () => {
    throw new NotImplementedError("getWealth");
  },
  markStatementPaid: async () => {
    throw new NotImplementedError("markStatementPaid");
  },
  getDebts: async () => {
    throw new NotImplementedError("getDebts");
  },
  markLoanPaid: async () => {
    throw new NotImplementedError("markLoanPaid");
  },
  addLoan: async () => {
    throw new NotImplementedError("addLoan");
  },
};
