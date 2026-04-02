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
import { HOUSEHOLD_ID } from "../../prisma/constants";

export const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
] as const;

export type MonthName = (typeof MONTH_NAMES)[number];

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
// Helpers
// ─────────────────────────────────────────────

export function isMonthInFuture(month: MonthName, year: number): boolean {
  const now = new Date();
  const selectedMonth = MONTH_NAMES.indexOf(month);
  return year > now.getFullYear() || (year === now.getFullYear() && selectedMonth > now.getMonth());
}

export function isCurrentMonth(month: MonthName, year: number): boolean {
  const now = new Date();
  return year === now.getFullYear() && MONTH_NAMES.indexOf(month) === now.getMonth();
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const AUTO_CATEGORIES = ["ALQUILER", "TDC", "GASTOS_FIJOS"] as const;

const ALL_CATEGORIES = [
  "ALQUILER","TDC","GASTOS_FIJOS","MERCADO",
  "GASTOS_LIBRES","AHORRO_CASA","AHORRO_VACACIONES","INVERSION_AHORRO","OTROS",
] as const;

const LABELS: Record<string, string> = {
  ALQUILER:          "Alquiler",
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
): Promise<DashboardData> {
  const isFuture = isMonthInFuture(month, year);

  // Real hasData: check if at least one income record exists
  const incomeCount = await prisma.income.count({
    where: { householdId: HOUSEHOLD_ID, month, year },
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

  // Fetch everything needed in parallel
  const [
    dbUsers,
    incomes,
    rentAgg,
    cardStatements,
    fixedAgg,
    groceryAgg,
    householdAgg,
    personalByUser,
    latestRate,
    budgetConfigs,
  ] = await Promise.all([
    prisma.user.findMany({ where: { householdId: HOUSEHOLD_ID } }),
    prisma.income.findMany({ where: { householdId: HOUSEHOLD_ID, month, year } }),
    prisma.rentPayment.aggregate({
      where: { householdId: HOUSEHOLD_ID, month, year },
      _sum: { amount: true },
    }),
    prisma.creditCardStatement.findMany({
      where: { householdId: HOUSEHOLD_ID, month, year },
    }),
    prisma.fixedExpense.aggregate({
      where: { householdId: HOUSEHOLD_ID, month, year },
      _sum: { amount: true },
    }),
    prisma.groceryExpense.aggregate({
      where: { householdId: HOUSEHOLD_ID, month, year },
      _sum: { amount: true },
    }),
    prisma.householdExpense.aggregate({
      where: { householdId: HOUSEHOLD_ID, month, year },
      _sum: { amount: true },
    }),
    prisma.personalExpense.groupBy({
      by: ["userId"],
      where: { householdId: HOUSEHOLD_ID, month, year },
      _sum: { amount: true },
    }),
    prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } }),
    prisma.budgetConfig.findMany({
      where: { householdId: HOUSEHOLD_ID, month, year },
    }),
  ]);

  const exchangeRate = latestRate ? Number(latestRate.usdArs) : 1477.20;

  // ── Income & users ────────────────────────────────────────────────────────
  const incomeByUser: Record<string, number> = {};
  for (const inc of incomes) {
    if (inc.type === "SUELDO") {
      incomeByUser[inc.createdById] = (incomeByUser[inc.createdById] ?? 0) + Number(inc.amount);
    }
  }
  const totalIncomeArs = Object.values(incomeByUser).reduce((s, v) => s + v, 0);

  const users: UserSummary[] = dbUsers.map((u) => ({
    id: u.id,
    name: u.name,
    avatarColor: u.avatarColor,
    incomeArs: incomeByUser[u.id] ?? 0,
    percentage: totalIncomeArs > 0 ? (incomeByUser[u.id] ?? 0) / totalIncomeArs : 0,
  }));

  // ── Auto amounts (come from DB records, not configurable %) ──────────────
  const autoAmounts: Record<string, number> = {
    ALQUILER:    Number(rentAgg._sum.amount ?? 0),
    TDC:         cardStatements.reduce((s, c) => s + Number(c.amountToPay), 0),
    GASTOS_FIJOS: Number(fixedAgg._sum.amount ?? 0),
  };

  // ── Used amounts (actual spending per category) ───────────────────────────
  const personalTotal = personalByUser.reduce((s, r) => s + Number(r._sum.amount ?? 0), 0);
  const usedAmounts: Record<string, number> = {
    ALQUILER:          autoAmounts.ALQUILER,
    TDC:               autoAmounts.TDC,
    GASTOS_FIJOS:      autoAmounts.GASTOS_FIJOS,
    MERCADO:           Number(groceryAgg._sum.amount ?? 0),
    GASTOS_LIBRES:     Number(householdAgg._sum.amount ?? 0),
    AHORRO_CASA:       0,
    AHORRO_VACACIONES: 0,
    INVERSION_AHORRO:  0,
    OTROS:             personalTotal,
  };

  // ── Budget config per category (from DB, with sensible defaults) ──────────
  const configMap = Object.fromEntries(budgetConfigs.map((c) => [c.category, c]));

  const categoryConfig: Record<string, {
    manualPercentage?: number;
    manualAmount?: number;
    isReserved: boolean;
  }> = {
    ALQUILER:         { isReserved: true },
    TDC:              { isReserved: true },
    GASTOS_FIJOS:     { isReserved: true },
    MERCADO: {
      manualAmount: configMap["MERCADO"]?.manualAmount
        ? Number(configMap["MERCADO"].manualAmount)
        : 500_000,
      isReserved: true,
    },
    GASTOS_LIBRES:    { isReserved: true },
    AHORRO_CASA: {
      manualPercentage: configMap["AHORRO_CASA"]?.manualPercentage
        ? Number(configMap["AHORRO_CASA"].manualPercentage)
        : 0,
      isReserved: false,
    },
    AHORRO_VACACIONES: {
      manualAmount: configMap["AHORRO_VACACIONES"]?.manualAmount
        ? Number(configMap["AHORRO_VACACIONES"].manualAmount)
        : 0,
      isReserved: false,
    },
    INVERSION_AHORRO: {
      manualPercentage: configMap["INVERSION_AHORRO"]?.manualPercentage
        ? Number(configMap["INVERSION_AHORRO"].manualPercentage)
        : 0,
      isReserved: false,
    },
    OTROS:            { isReserved: true },
  };

  // ── First pass: compute raw budgeted amounts (needed for gastos libres) ───
  const rawAmounts: Record<string, number> = {};
  const reservedAmounts: number[] = [];

  for (const key of ALL_CATEGORIES) {
    if (key === "GASTOS_LIBRES") continue;
    const cfg     = categoryConfig[key];
    const autoAmt = autoAmounts[key] ?? 0;
    const amt     = calculateCategoryAmount(totalIncomeArs, { category: key, ...cfg }, autoAmt);
    rawAmounts[key] = amt;
    if (cfg.isReserved) reservedAmounts.push(amt);
  }
  rawAmounts["GASTOS_LIBRES"] = calculateGastosLibres(totalIncomeArs, reservedAmounts);

  // ── Second pass: build CategoryRow array ──────────────────────────────────
  const categories: CategoryRow[] = ALL_CATEGORIES.map((key) => {
    const cfg        = categoryConfig[key];
    const budgetedArs = rawAmounts[key];
    const usedArs    = usedAmounts[key] ?? 0;
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
      label:    LABELS[key],
      isAuto:   AUTO_CATEGORIES.includes(key as typeof AUTO_CATEGORIES[number]),
      budgetedArs,
      usedArs,
      availableArs,
      percentage: calculateCategoryPercentage(budgetedArs, totalIncomeArs),
      manualPercentage: cfg.manualPercentage,
      manualAmount:     cfg.manualAmount,
      isReserved:       cfg.isReserved,
      perUser,
      isOverspent: availableArs < 0,
    };
  });

  const surplusArs = totalIncomeArs - categories
    .filter((c) => c.isReserved)
    .reduce((s, c) => s + c.budgetedArs, 0);

  // ── TDC alerts: cards due within 7 days ───────────────────────────────────
  const now    = new Date();
  const in7    = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const tdcAlerts: TdcAlert[] = cardStatements
    .filter((c) => !c.isPaid && new Date(c.dueDate) <= in7)
    .map((c) => {
      const msLeft = new Date(c.dueDate).getTime() - now.getTime();
      return {
        id:          c.id,
        cardName:    c.cardName,
        dueDate:     c.dueDate.toISOString(),
        amountToPay: Number(c.amountToPay),
        daysUntilDue: Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24))),
      };
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  return {
    month,
    year,
    isFuture: false,
    hasData: true,
    totalIncomeArs,
    totalUsd: 0,
    exchangeRate,
    surplusArs,
    users,
    categories,
    tdcAlerts,
  };
}
