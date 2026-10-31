/**
 * Lógica de dominio de la app = la de la web. Una sola fuente de verdad:
 * `src/lib/plan/core.ts` (raíz del repo) es pura (sin DB ni React) y Metro la ve por `watchFolders`.
 *
 * Qué NO se re-exporta a propósito:
 *  - lo que devuelve texto en español (`loanRateLabel`, `LOAN_MODE_LABEL`, `periodLabel`, `fmt*`, `*Label`):
 *    en la app el texto sale de i18n.
 *  - `currentPeriod` / `todayIso` se re-exportan con resguardo (abajo): usan Intl con zona horaria
 *    y el motor de JS del teléfono puede no traerlo completo.
 *
 * El `.ts` explícito en el import hace que también lo resuelva `node --test` (los tests de datos).
 */
export type {
  Currency,
  Frequency,
  LoanAnchorDTO,
  LoanDirection,
  LoanDTO,
  LoanMode,
  LoanPaymentDTO,
  LoanProposalRow,
  LoanState,
  ProposalRow,
  // Resumen del mes y presupuesto (misma lógica que la web).
  BudgetDTO,
  BudgetRow,
  BudgetStatus,
  CardDTO,
  CategoryDTO,
  EntryDTO,
  PurchaseDTO,
  RecurringDTO,
  ReservedRow,
  StatementDTO,
  Summary,
  SummaryInput,
} from "../../../src/lib/plan/core.ts";

export type { MonthPlan } from "./monthPlan.ts";
export { normalizeText, parseSpokenAmount } from "./amountText.ts";

export {
  addDays,
  addMonths,
  balanceAt,
  buildLoanProposal,
  buildProposal,
  buildSummary,
  cardLines,
  daysInPeriod,
  formatMoneyInput,
  frenchInstallment,
  isLoanFinished,
  isValidPeriod,
  isReceivable,
  loanBalanceItem,
  loanDueDate,
  loanKind,
  loanState,
  monthDiff,
  monthlyAmount,
  occurrencesInPeriod,
  monthlyRatePct,
  NEAR_THRESHOLD,
  numberToInput,
  parseMoney,
  proposeLoanPayment,
  round2,
  TDC_KEY,
  toArs,
} from "../../../src/lib/plan/core.ts";

// `dailyAllowance` de core (libre ÷ días que quedan, contando hoy); el de `data/selectors` solo divide.
export { dailyAllowance as planDailyAllowance } from "../../../src/lib/plan/core.ts";

import { currentPeriod as coreCurrentPeriod, todayIso as coreTodayIso } from "../../../src/lib/plan/core.ts";

/** Buenos Aires no tiene horario de verano: −3 h fijo como resguardo. */
function baIso(now: Date): string {
  return new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
}

/** Mes actual 'YYYY-MM' (hora de Buenos Aires). */
export function currentPeriod(now: Date = new Date()): string {
  try {
    return coreCurrentPeriod(now);
  } catch {
    return baIso(now).slice(0, 7);
  }
}

/** Fecha de hoy 'YYYY-MM-DD' (hora de Buenos Aires). */
export function todayIso(now: Date = new Date()): string {
  try {
    return coreTodayIso(now);
  } catch {
    return baIso(now).slice(0, 10);
  }
}

// Carga por voz: contrato compartido con la API web (`src/lib/plan/voice.ts`, lógica pura).
export type {
  EntryDraft,
  IncomeDraft,
  VoiceApiError,
  VoiceContext,
  VoiceExtraction,
  VoiceFrequency,
  VoiceIntent,
  VoiceOutcome,
  VoicePendingIntent,
  VoiceSupportedIntent,
} from "../../../src/lib/plan/voice.ts";

export { VOICE_SUPPORTED, resolveVoiceOutcome } from "../../../src/lib/plan/voice.ts";
