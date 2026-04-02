/**
 * Dashboard data layer.
 * Aggregates all data sources into a single DashboardData shape.
 * Uses mock data until auth + Prisma client are wired up.
 */

import {
  calculateCategoryAmount,
  calculateCategoryPercentage,
  calculatePerUserBudget,
  calculateGastosLibres,
} from "./budget";

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
  isFuture: boolean;   // month/year is ahead of today
  hasData: boolean;    // at least one income or expense exists for this period
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
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const selectedMonth = MONTH_NAMES.indexOf(month); // 0-indexed
  return year > currentYear || (year === currentYear && selectedMonth > currentMonth);
}

export function isCurrentMonth(month: MonthName, year: number): boolean {
  const now = new Date();
  return year === now.getFullYear() && MONTH_NAMES.indexOf(month) === now.getMonth();
}

/** Months that have real data in the mock. Replace with DB query result. */
const MONTHS_WITH_DATA = new Set([
  "octubre-2024","noviembre-2024","diciembre-2024","enero-2026",
]);

export function monthHasData(month: MonthName, year: number): boolean {
  // TODO: replace with: return prisma.income.count({ where: { month, year, householdId } }) > 0
  return MONTHS_WITH_DATA.has(`${month}-${year}`);
}

// ─────────────────────────────────────────────
// Mock data — replace with real Prisma queries
// ─────────────────────────────────────────────

const MOCK_USERS = [
  { id: "avelino", name: "Avelino", avatarColor: "#6366F1", incomeArs: 4_387_957 },
  { id: "maria",   name: "Maria",   avatarColor: "#EC4899", incomeArs: 957_250  },
];

const MOCK_AUTO = {
  alquiler:    1_095_397,
  tdc:         6_121_144,
  gastos_fijos:   79_083,
};

const MOCK_USED = {
  ALQUILER:         1_095_397,
  TDC:              5_321_144,
  GASTOS_FIJOS:        79_083,
  MERCADO:            763_862,
  GASTOS_LIBRES:      120_000,
  AHORRO_CASA:              0,
  AHORRO_VACACIONES:        0,
  INVERSION_AHORRO:         0,
  OTROS:              113_646,
};

const MOCK_CONFIG: Record<string, { manualPercentage?: number; manualAmount?: number; isReserved: boolean }> = {
  ALQUILER:         { isReserved: true  },
  TDC:              { isReserved: true  },
  GASTOS_FIJOS:     { isReserved: true  },
  MERCADO:          { manualAmount: 500_000, isReserved: true  },
  GASTOS_LIBRES:    { isReserved: true  },
  AHORRO_CASA:      { manualPercentage: 0, isReserved: false },
  AHORRO_VACACIONES:{ manualAmount: 0,    isReserved: false },
  INVERSION_AHORRO: { manualPercentage: 0, isReserved: false },
  OTROS:            { isReserved: true  },
};

const MOCK_TDC_ALERTS: TdcAlert[] = [
  {
    id: "1",
    cardName: "VISA AVELINO BK",
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
    amountToPay: 157_000,
    daysUntilDue: 2,
  },
];

// ─────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────

export async function getDashboardData(
  month: MonthName,
  year: number,
  // householdId: string  ← add once auth is wired
): Promise<DashboardData> {
  const isFuture = isMonthInFuture(month, year);
  const hasData = !isFuture && monthHasData(month, year);

  // Return early shell for months with no data
  if (!hasData) {
    return {
      month, year, isFuture, hasData,
      totalIncomeArs: 0, totalUsd: 0, exchangeRate: 1477.20,
      surplusArs: 0, users: [], categories: [], tdcAlerts: [],
    };
  }

  // TODO: replace mock with:
  // const [incomes, cards, fixed, groceries, expenses, configs, rate] = await Promise.all([
  //   prisma.income.findMany({ where: { householdId, month, year } }),
  //   ...
  // ])

  const totalIncomeArs = MOCK_USERS.reduce((s, u) => s + u.incomeArs, 0);
  const exchangeRate = 1477.20;
  const totalUsd = 840;

  // Build user summaries with percentage split
  const users: UserSummary[] = MOCK_USERS.map((u) => ({
    ...u,
    percentage: totalIncomeArs > 0 ? u.incomeArs / totalIncomeArs : 0,
  }));

  // Build category rows
  const AUTO_CATEGORIES = ["ALQUILER", "TDC", "GASTOS_FIJOS"] as const;
  const ALL_CATEGORIES = [
    "ALQUILER","TDC","GASTOS_FIJOS","MERCADO",
    "GASTOS_LIBRES","AHORRO_CASA","AHORRO_VACACIONES","INVERSION_AHORRO","OTROS",
  ] as const;

  const LABELS: Record<string, string> = {
    ALQUILER: "Alquiler",
    TDC: "Tarjetas de crédito",
    GASTOS_FIJOS: "Gastos fijos",
    MERCADO: "Mercado",
    GASTOS_LIBRES: "Gastos libres",
    AHORRO_CASA: "Ahorro casa",
    AHORRO_VACACIONES: "Ahorro vacaciones",
    INVERSION_AHORRO: "Inversión & ahorro",
    OTROS: "Otros",
  };

  // First pass: calculate all reserved amounts for gastos libres
  const reservedAmounts: number[] = [];
  const rawAmounts: Record<string, number> = {};

  for (const key of ALL_CATEGORIES) {
    if (key === "GASTOS_LIBRES") continue;
    const cfg = MOCK_CONFIG[key];
    const autoAmt = MOCK_AUTO[key.toLowerCase() as keyof typeof MOCK_AUTO] ?? 0;
    const amt = calculateCategoryAmount(totalIncomeArs, { category: key, ...cfg }, autoAmt);
    rawAmounts[key] = amt;
    if (cfg.isReserved) reservedAmounts.push(amt);
  }

  rawAmounts["GASTOS_LIBRES"] = calculateGastosLibres(totalIncomeArs, reservedAmounts);

  // Second pass: build full rows
  const categories: CategoryRow[] = ALL_CATEGORIES.map((key) => {
    const cfg = MOCK_CONFIG[key];
    const budgetedArs = rawAmounts[key];
    const usedArs = MOCK_USED[key] ?? 0;
    const availableArs = budgetedArs - usedArs;
    const perUserBudget = calculatePerUserBudget(
      budgetedArs,
      users.map((u) => ({ userId: u.id, name: u.name, incomeArs: u.incomeArs }))
    );

    const perUser: CategoryRow["perUser"] = {};
    for (const u of users) {
      const userUsed = usedArs * u.percentage; // approximation until real data
      perUser[u.id] = {
        budgeted: perUserBudget[u.id],
        used: userUsed,
        available: perUserBudget[u.id] - userUsed,
      };
    }

    return {
      key,
      label: LABELS[key],
      isAuto: AUTO_CATEGORIES.includes(key as typeof AUTO_CATEGORIES[number]),
      budgetedArs,
      usedArs,
      availableArs,
      percentage: calculateCategoryPercentage(budgetedArs, totalIncomeArs),
      manualPercentage: cfg.manualPercentage,
      manualAmount: cfg.manualAmount,
      isReserved: cfg.isReserved,
      perUser,
      isOverspent: availableArs < 0,
    };
  });

  const surplusArs = totalIncomeArs - categories
    .filter((c) => c.isReserved)
    .reduce((s, c) => s + c.budgetedArs, 0);

  return {
    month,
    year,
    isFuture: false,
    hasData: true,
    totalIncomeArs,
    totalUsd,
    exchangeRate,
    surplusArs,
    users,
    categories,
    tdcAlerts: MOCK_TDC_ALERTS,
  };
}
