export interface AccountDTO {
  id: string; name: string; ownerUserId: string; householdId: string; financeName: string;
  type: "BANK" | "WALLET" | "CASH" | "OTHER"; currency: "ARS" | "USD";
  openingBalance: number; openingDate: string | null; balance: number; isArchived: boolean;
  isOwner: boolean; originFinanceName: string | null;
}
export interface ResourceCardDTO {
  unpaidArs?: number; unpaidUsd?: number; unpaidStatements?: number;
  id: string; name: string; entity: string | null; cardType: string | null; ownerName: string | null;
  ownerUserId: string | null; householdId: string; financeName: string; isOwner: boolean; originFinanceName: string | null;
}
export interface AccountMovementDTO {
  id: string; type: "ENTRY" | "TRANSFER" | "CARD_PAYMENT"; name: string;
  amount: number; currency: "ARS" | "USD"; date: string | null; householdId: string | null;
  financeName: string | null; originFinanceName: string | null; masked?: boolean;
}
export interface CardMovementDTO {
  id: string; type: "PURCHASE" | "STATEMENT"; name: string; detail: string | null;
  amount: number; currency: "ARS" | "USD"; date: string | null; isPaid: boolean | null; masked?: boolean;
}
