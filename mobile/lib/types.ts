// Contrato del backend. Se declara acá (y no se importa de src/lib/plan/server.ts) porque
// ese archivo arrastra Next/Prisma. Mantener en sincronía con `PlanData` e `InboxItemDTO`.
import type {
  BalanceItemDTO, BudgetDTO, CardDTO, CategoryDTO, Currency, EntryDTO, LoanDTO, LoanProposalRow,
  ProposalRow, PurchaseDTO, RecurringDTO, StatementDTO,
} from "./core";

export type FinanceRole = "ADMIN" | "EDITOR" | "VIEWER";
export type FinanceKind = "PERSONAL" | "SHARED";

/** Finanza del usuario (GET /api/plan/finances). Sincronizado con `FinanceDTO` de src/lib/plan/finances.ts. */
export interface FinanceDTO {
  id: string;
  name: string;
  kind: FinanceKind;
  /** Clave de paleta (`violeta`…); null en PERSONAL = color de Omero. */
  color: string | null;
  role: FinanceRole;
  ownerUserId: string | null;
  isOwner: boolean;
  memberCount: number;
}

/** Finanza que se está viendo (dentro de `PlanData`). Sincronizado con `PlanFinanceDTO` de src/lib/plan/server.ts. */
export interface PlanFinance {
  id: string;
  name: string;
  kind: FinanceKind;
  color: string | null;
  role: FinanceRole;
}

export interface FinanceMemberDTO {
  userId: string;
  name: string;
  email: string;
  role: FinanceRole;
  isOwner: boolean;
}

export interface MoveEntriesResult {
  moved: string[];
  skipped: { id: string; reason: string }[];
  from: FinanceDTO;
  to: FinanceDTO;
}

export interface PlanData {
  period: string;
  today: string;
  started: boolean;
  usdRate: number;
  categories: CategoryDTO[];
  recurrings: RecurringDTO[];
  entries: EntryDTO[];
  budgets: BudgetDTO[];
  previousBudgets: BudgetDTO[];
  previousBudgetPeriod: string | null;
  cards: CardDTO[];
  cardStatementCounts: Record<string, number>;
  statements: StatementDTO[];
  purchases: PurchaseDTO[];
  proposal: ProposalRow[];
  loans: LoanDTO[];
  loanProposal: LoanProposalRow[];
  inboxPendingCount: number;
  finance: PlanFinance;
}

export interface InboxItemDTO {
  id: string;
  source: string;
  merchant: string | null;
  amount: number | null;
  currency: Currency;
  walletCard: string | null;
  occurredAt: string;
  suggestedCategoryId: string | null;
  suggestedMethod: "DEBIT" | "CARD" | null;
  suggestedCardId: string | null;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  householdId: string;
  role: string;
}

/** `GET /api/plan/balance`. */
export interface BalanceResponse {
  items: BalanceItemDTO[];
}
