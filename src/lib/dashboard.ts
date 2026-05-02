/**
 * Dashboard data layer.
 * Aggregates all data sources into a single DashboardData shape.
 */

import {
  calculateCategoryAmount,
  calculateCategoryPercentage,
  calculatePerUserBudget,
  calculateGastosLibres,
} from "./budget";
import { prisma } from "./prisma";
import { MONTH_NAMES, type MonthName, isMonthInFuture, isCurrentMonth } from "./months";
export { MONTH_NAMES, type MonthName, isMonthInFuture, isCurrentMonth };

export interface UserSummary {
  id: string;
  name: string;
  avatarColor: string;
  incomeArs: number;
  percentage: number; // 0–1
}

export interface CategoryRow {
  key: string;
  label: string;
  isAuto: boolean;       // true = amount comes from DB, not editable as %
  budgetedArs: number;
  usedArs: number;
  availableArs: number;
  percentage: number;    // of total income
  manualPercentage?: number;
  manualAmount?: number;
  isReserved: boolean;
  perUser: Record<string, { budgeted: number; used: number; available: number }>;
  isOverspent: boolean;
}

export interface TdcAlert {
  id: string;
  cardName: string;
  dueDate: string; // ISO
  amountToPay: number;
  daysUntilDue: number;
}

export interface DashboardData {
  month: MonthName;
  year: number;
  isFuture: boolean;
  hasData: boolean;
  totalIncomeArs: number;
  totalUsd: number;
  exchangeRate: number;
  surplusArs: number;
  users: UserSummary[];
  categories: CategoryRow[];
  tdcAlerts: TdcAlert[];
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

// ALQUILER is no longer a separate budget category — it's included in GASTOS_FIJOS templates
const AUTO_CATEGORIES = ["TDC", "GASTOS_FIJOS"] as const;

const ALL_CATEGORIES = [
  "TDC", "GASTOS_FIJOS", "MERCADO",
  "GASTOS_LIBRES", "AHORRO_CASA", "AHORRO_VACACIONES", "INVERSION_AHORRO", "OTROS",
] as const;

const LABELS: Record<string, string> = {
  TDC:               "Tarjetas de crédito",
  GASTOS_FIJOS:      "Gastos fijos",
  MERCADO:           "Mercado",
  GASTOS_LIBRES:     "Gastos libres",
  AHORRO_CASA:       "Ahorro casa",
  AHORRO_VACACIONES: "Ahorro vacaciones",
  INVERSION_AHORRO:  "Inversión & ahorro",
  OTROS:             "Otros",
};

// ─────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────

export async function getDashboardData(
  month: MonthName,
  year: number,
  householdId: string,
): Promise<DashboardData> {
  const isFuture = isMonthInFuture(month, year);

  const incomeCount = await prisma.income.count({
    where: { householdId: householdId, month, year },
  });
  const hasData = !isFuture && incomeCount > 0;

  if (!hasData) {
    const fallbackRate = await prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } });
    return {
      month, year, isFuture, hasData,
      totalIncomeArs: 0, totalUsd: 0,
      exchangeRate: fallbackRate ? Number(fallbackRate.usdArs) : 1477.20,
      surplusArs: 0, users: [], categories: [], tdcAlerts: [],
    };
  }

  // Date range for this month (for models with `date: DateTime` instead of month/year strings)
  const monthIdx = MONTH_NAMES.indexOf(month); // 0–11
  const monthStart = new Date(year, monthIdx, 1);
  const monthEnd   = new Date(year, monthIdx + 1, 0, 23, 59, 59, 999);

  // Fetch everything in parallel
  const [
    dbUsers,
    incomes,
    cardStatements,
    fixedTemplates,
    fixedExpenseAgg,
    groceryAgg,
    householdAgg,
    personalByUser,
    savingsByType,
    latestRate,
    budgetConfigs,
  ] = await Promise.all([
    prisma.user.findMany({ where: { householdId: householdId } }),

    prisma.income.findMany({ where: { householdId: householdId, month, year } }),

    prisma.creditCardStatement.findMany({
      where: { householdId: householdId, month, year },
    }),

    // Fixed expense TEMPLATES (active ARS) — defines the budget line (what's committed)
    prisma.fixedExpenseTemplate.findMany({
      where: { householdId: householdId, isActive: true, currency: "ARS" },
      select: { amount: true },
    }),

    // Actual fixed expense records logged this month — what's been used
    prisma.fixedExpense.aggregate({
      where: { householdId: householdId, month, year },
      _sum: { amount: true },
    }),

    prisma.groceryExpense.aggregate({
      where: { householdId: householdId, month, year },
      _sum: { amount: true },
    }),

    prisma.householdExpense.aggregate({
      where: { householdId: householdId, month, year },
      _sum: { amount: true },
    }),

    prisma.personalExpense.groupBy({
      by: ["userId"],
      where: { householdId: householdId, month, year },
      _sum: { amount: true },
    }),

    // Savings for this month, grouped by type (ARS only for budget purposes)
    prisma.saving.groupBy({
      by: ["type"],
      where: {
        householdId: householdId,
        currency: "ARS",
        date: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    }),

    prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } }),

    prisma.budgetConfig.findMany({
      where: { householdId: householdId, month, year },
    }),
  ]);

  const exchangeRate = latestRate ? Number(latestRate.usdArs) : 1477.20;

  // ── Income & users ─────────────────────────────────────────────────────────
  // Count all income types (not just SUELDO) for the total budget
  const totalIncomeArs = incomes.reduce((s, i) => s + Number(i.amountArs ?? i.amount), 0);

  // Per-user split based on SUELDO only (for proportional breakdown)
  const incomeByUser: Record<string, number> = {};
  for (const inc of incomes) {
    if (inc.type === "SUELDO") {
      incomeByUser[inc.createdById] = (incomeByUser[inc.createdById] ?? 0) + Number(inc.amount);
    }
  }
  const sueldoTotal = Object.values(incomeByUser).reduce((s, v) => s + v, 0);

  const users: UserSummary[] = dbUsers.map((u) => ({
    id: u.id,
    name: u.name,
    avatarColor: u.avatarColor,
    incomeArs: incomeByUser[u.id] ?? 0,
    percentage: sueldoTotal > 0 ? (incomeByUser[u.id] ?? 0) / sueldoTotal : 0,
  }));

  // ── Auto amounts (from DB, not configurable) ───────────────────────────────
  const fixedTemplateTotal = fixedTemplates.reduce((s, t) => s + Number(t.amount), 0);

  function tdcEffective(c: { amountToPay: unknown; minimumPayment: unknown; payMinimum: boolean; committedOverride: unknown; usdAmount: unknown }) {
    if (c.payMinimum && c.minimumPayment) return Number(c.minimumPayment);
    if (!c.payMinimum && c.committedOverride != null) return Number(c.committedOverride);
    const usdInArs = c.usdAmount ? Number(c.usdAmount) * exchangeRate : 0;
    return Number(c.amountToPay) + usdInArs;
  }

  // autoAmounts = what is budgeted/committed (ALL statements, paid or not)
  const autoAmounts: Record<string, number> = {
    TDC:          cardStatements.reduce((s, c) => s + tdcEffective(c), 0),
    GASTOS_FIJOS: fixedTemplateTotal,
  };

  // TDC actually paid (only isPaid = true) — for usedAmounts
  const tdcPaidTotal = cardStatements
    .filter((c) => c.isPaid)
    .reduce((s, c) => s + tdcEffective(c), 0);

  // ── Savings used this month (by saving type) ───────────────────────────────
  const savingsMap: Record<string, number> = {};
  for (const s of savingsByType) {
    savingsMap[s.type] = Number(s._sum.amount ?? 0);
  }

  // ── Used amounts (actual spending per category) ────────────────────────────
  const personalTotal = personalByUser.reduce((s, r) => s + Number(r._sum.amount ?? 0), 0);

  const usedAmounts: Record<string, number> = {
    TDC:               tdcPaidTotal,               // TDC used = only what's actually been paid
    GASTOS_FIJOS:      Number(fixedExpenseAgg._sum.amount ?? 0), // only logged fixed expenses
    MERCADO:           Number(groceryAgg._sum.amount ?? 0),
    GASTOS_LIBRES:     Number(householdAgg._sum.amount ?? 0),
    AHORRO_CASA:       savingsMap["AHORRO"]     ?? 0,
    AHORRO_VACACIONES: savingsMap["VIAJE"]      ?? 0,
    INVERSION_AHORRO:  savingsMap["INVERSION"]  ?? 0,
    OTROS:             personalTotal,
  };

  // ── Budget config per category (from DB) ──────────────────────────────────
  const configMap = Object.fromEntries(budgetConfigs.map((c) => [c.category, c]));

  function getCfg(key: string, defaultIsReserved = true) {
    const c = configMap[key];
    return {
      manualPercentage: c?.manualPercentage ? Number(c.manualPercentage) : undefined,
      manualAmount:     c?.manualAmount     ? Number(c.manualAmount)     : undefined,
      isReserved:       c?.isReserved       ?? defaultIsReserved,
    };
  }

  const categoryConfig: Record<string, ReturnType<typeof getCfg>> = {
    TDC:               { isReserved: true, manualPercentage: undefined, manualAmount: undefined },
    GASTOS_FIJOS:      { isReserved: true, manualPercentage: undefined, manualAmount: undefined },
    MERCADO:           getCfg("MERCADO",           true),
    GASTOS_LIBRES:     getCfg("GASTOS_LIBRES",     true),
    AHORRO_CASA:       getCfg("AHORRO_CASA",       false),
    AHORRO_VACACIONES: getCfg("AHORRO_VACACIONES", false),
    INVERSION_AHORRO:  getCfg("INVERSION_AHORRO",  false),
    OTROS:             getCfg("OTROS",             true),
  };

  // ── First pass: compute raw budgeted amounts (needed for gastos libres) ────
  const rawAmounts: Record<string, number> = {};
  const reservedAmounts: number[] = [];

  for (const key of ALL_CATEGORIES) {
    if (key === "GASTOS_LIBRES") continue;
    const cfg    = categoryConfig[key];
    const auto   = autoAmounts[key] ?? 0;
    const amt    = calculateCategoryAmount(totalIncomeArs, { category: key, ...cfg }, auto);
    rawAmounts[key] = amt;
    if (cfg.isReserved) reservedAmounts.push(amt);
  }
  // GASTOS_LIBRES: use manual config if set, otherwise auto-calculate as remainder
  const gastosLibresCfg = categoryConfig["GASTOS_LIBRES"];
  const gastosLibresManual = calculateCategoryAmount(totalIncomeArs, { category: "GASTOS_LIBRES", ...gastosLibresCfg }, 0);
  rawAmounts["GASTOS_LIBRES"] = gastosLibresManual > 0
    ? gastosLibresManual
    : calculateGastosLibres(totalIncomeArs, reservedAmounts);

  // ── Second pass: build CategoryRow array ───────────────────────────────────
  const categories: CategoryRow[] = ALL_CATEGORIES.map((key) => {
    const cfg         = categoryConfig[key];
    const budgetedArs = rawAmounts[key];
    const usedArs     = usedAmounts[key] ?? 0;
    const availableArs = budgetedArs - usedArs;

    const perUserBudget = calculatePerUserBudget(
      budgetedArs,
      users.map((u) => ({ userId: u.id, name: u.name, incomeArs: u.incomeArs })),
    );

    const perUser: CategoryRow["perUser"] = {};
    for (const u of users) {
      const userUsed = usedArs * u.percentage;
      perUser[u.id] = {
        budgeted:  perUserBudget[u.id],
        used:      userUsed,
        available: perUserBudget[u.id] - userUsed,
      };
    }

    return {
      key,
      label:           LABELS[key],
      isAuto:          AUTO_CATEGORIES.includes(key as typeof AUTO_CATEGORIES[number]),
      budgetedArs,
      usedArs,
      availableArs,
      percentage:      calculateCategoryPercentage(budgetedArs, totalIncomeArs),
      manualPercentage: cfg.manualPercentage,
      manualAmount:     cfg.manualAmount,
      isReserved:       cfg.isReserved,
      perUser,
      isOverspent:     availableArs < 0,
    };
  });

  const surplusArs = totalIncomeArs - categories
    .filter((c) => c.isReserved)
    .reduce((s, c) => s + c.budgetedArs, 0);

  // ── TDC alerts: cards due within 7 days ───────────────────────────────────
  const now  = new Date();
  const in3  = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const tdcAlerts: TdcAlert[] = cardStatements
    .filter((c) => !c.isPaid && new Date(c.dueDate) <= in3)
    .map((c) => {
      const msLeft = new Date(c.dueDate).getTime() - now.getTime();
      return {
        id:           c.id,
        cardName:     c.cardName,
        dueDate:      c.dueDate.toISOString(),
        amountToPay:  Number(c.amountToPay),
        daysUntilDue: Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24))),
      };
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  return {
    month,
    year,
    isFuture: false,
    hasData:  true,
    totalIncomeArs,
    totalUsd: 0,
    exchangeRate,
    surplusArs,
    users,
    categories,
    tdcAlerts,
  };
}
