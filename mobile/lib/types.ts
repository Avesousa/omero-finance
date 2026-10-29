// Contrato del backend. Se declara acá (y no se importa de src/lib/plan/server.ts) porque
// ese archivo arrastra Next/Prisma. Mantener en sincronía con `PlanData` e `InboxItemDTO`.
import type {
  BudgetDTO, CardDTO, CategoryDTO, Currency, EntryDTO, LoanDTO, LoanProposalRow,
  ProposalRow, PurchaseDTO, RecurringDTO, StatementDTO,
} from "./core";

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
