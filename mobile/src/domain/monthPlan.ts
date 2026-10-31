import type {
  BudgetDTO,
  CardDTO,
  CategoryDTO,
  EntryDTO,
  LoanDTO,
  PurchaseDTO,
  RecurringDTO,
  StatementDTO,
} from "../../../src/lib/plan/core.ts";

/**
 * Lo que la app necesita para armar un mes: el subconjunto de `PlanData` (web, `src/lib/plan/server.ts`)
 * que usa. Es exactamente lo que devuelve `GET /api/plan/data` (sin los campos que la app ignora),
 * así que en modo api sale de ahí sin traducir. Se declara acá porque `server.ts` arrastra Next/Prisma.
 * Mantener en sincronía con `PlanData`.
 */
export interface MonthPlan {
  period: string;
  /** Hoy en Buenos Aires ('YYYY-MM-DD'). */
  today: string;
  /** El mes ya tiene movimientos cargados. */
  started: boolean;
  usdRate: number;
  categories: CategoryDTO[];
  recurrings: RecurringDTO[];
  entries: EntryDTO[];
  budgets: BudgetDTO[];
  /** Presupuesto del último mes anterior que tenga uno (para copiar). */
  previousBudgets: BudgetDTO[];
  previousBudgetPeriod: string | null;
  cards: CardDTO[];
  statements: StatementDTO[];
  purchases: PurchaseDTO[];
  loans: LoanDTO[];
}
