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
  LoanState,
} from "../../../src/lib/plan/core.ts";

export {
  addDays,
  addMonths,
  balanceAt,
  daysInPeriod,
  formatMoneyInput,
  frenchInstallment,
  isLoanFinished,
  isValidPeriod,
  loanBalanceItem,
  loanDueDate,
  loanKind,
  loanState,
  monthDiff,
  monthlyRatePct,
  numberToInput,
  parseMoney,
  proposeLoanPayment,
  round2,
  toArs,
} from "../../../src/lib/plan/core.ts";

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
