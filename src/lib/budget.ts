/**
 * Core budget calculation functions.
 * Pure functions — no DB, no side effects. Fully unit-testable.
 */

export type Currency = "ARS" | "USD";

export interface UserSplit {
  userId: string;
  name: string;
  incomeArs: number;
}

export interface CategoryConfig {
  category: string;
  manualPercentage?: number; // 0–1
  manualAmount?: number;     // ARS
}

export interface CategoryResult {
  category: string;
  percentage: number;
  amountArs: number;
  usedArs: number;
  availableArs: number;
  perUser: Record<string, { budgeted: number; used: number; available: number }>;
}

/**
 * Calculate the final budgeted amount for a category.
 * Rules:
 *  - If manualAmount > 0 → use it directly
 *  - If manualPercentage > 0 → percentage * totalIncome
 *  - Otherwise → amount is externally provided (auto-categories like TDC, rent, fixed)
 */
export function calculateCategoryAmount(
  totalIncomeArs: number,
  config: CategoryConfig,
  autoAmount = 0
): number {
  if (config.manualAmount && config.manualAmount > 0) return config.manualAmount;
  if (config.manualPercentage && config.manualPercentage > 0) {
    return totalIncomeArs * config.manualPercentage;
  }
  return autoAmount;
}

/**
 * Calculate percentage a category represents of total income.
 */
export function calculateCategoryPercentage(
  amountArs: number,
  totalIncomeArs: number
): number {
  if (totalIncomeArs === 0) return 0;
  return amountArs / totalIncomeArs;
}

/**
 * Calculate each user's share of a category amount based on their income split.
 */
export function calculatePerUserBudget(
  categoryAmountArs: number,
  users: UserSplit[]
): Record<string, number> {
  const totalIncome = users.reduce((sum, u) => sum + u.incomeArs, 0);
  if (totalIncome === 0) return Object.fromEntries(users.map((u) => [u.userId, 0]));

  return Object.fromEntries(
    users.map((u) => [u.userId, categoryAmountArs * (u.incomeArs / totalIncome)])
  );
}

/**
 * Calculate "Gastos Libres" — the remainder after all reserved categories.
 * Never negative.
 */
export function calculateGastosLibres(
  totalIncomeArs: number,
  reservedAmounts: number[]
): number {
  const totalReserved = reservedAmounts.reduce((sum, a) => sum + a, 0);
  return Math.max(0, totalIncomeArs - totalReserved);
}

/**
 * Determine the amount to pay for a credit card statement.
 * Priority: custom → minimum → total + USD conversion
 */
export function calculateAmountToPay(params: {
  totalAmountArs: number;
  minimumPayment?: number;
  customAmount?: number;
  usdAmount?: number;
  dollarRateSnapshot?: number;
  payMinimum: boolean;
}): number {
  const { totalAmountArs, minimumPayment, customAmount, usdAmount, dollarRateSnapshot, payMinimum } = params;

  if (customAmount && customAmount > 0) return customAmount;
  if (payMinimum && minimumPayment && minimumPayment > 0) return minimumPayment;

  const usdInArs = (usdAmount ?? 0) * (dollarRateSnapshot ?? 0);
  return totalAmountArs + usdInArs;
}

/**
 * Calculate total amount to repay for a loan.
 * Formula: principal + (principal × rate × installments)
 */
export function calculateLoanTotal(
  principal: number,
  interestRate: number,
  installments: number
): number {
  return principal + principal * interestRate * installments;
}

/**
 * Separate ARS and USD funds from a list of financial movements.
 */
export interface Movement {
  currency: Currency;
  amount: number;           // positive = income, negative = expense
  amountArs?: number;       // populated if currency=USD and converted
  dollarRateSnapshot?: number;
}

export interface Funds {
  arsTotal: number;   // ARS fund (includes conversions from USD)
  usdTotal: number;   // USD fund (non-converted USD only)
}

export function calculateFunds(movements: Movement[]): Funds {
  let arsTotal = 0;
  let usdTotal = 0;

  for (const m of movements) {
    if (m.currency === "ARS") {
      arsTotal += m.amount;
    } else {
      // USD movement
      if (m.amountArs != null) {
        // Was converted → counts toward ARS fund
        arsTotal += m.amountArs;
      } else {
        // Not converted → counts toward USD fund
        usdTotal += m.amount;
      }
    }
  }

  return { arsTotal, usdTotal };
}
