import { NextResponse } from "next/server";
import { getDashboardData, MONTH_NAMES, type MonthName } from "@/lib/dashboard";

/** GET /api/dashboard?month=abril&year=2026
 *  Returns aggregated dashboard data for the given month/year.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month");
  const yearParam  = searchParams.get("year");

  const now = new Date();
  const month = (
    monthParam && MONTH_NAMES.includes(monthParam as MonthName)
      ? monthParam
      : MONTH_NAMES[now.getMonth()]
  ) as MonthName;
  const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();

  const data = await getDashboardData(month, year);

  const totalBudgeted = data.categories.reduce((s, c) => s + c.budgetedArs, 0);
  const totalSpent    = data.categories.reduce((s, c) => s + c.usedArs, 0);

  return NextResponse.json({
    month:        data.month,
    year:         data.year,
    hasData:      data.hasData,
    isFuture:     data.isFuture,
    totalIncome:  data.totalIncomeArs,
    surplusArs:   data.surplusArs,
    totalBudgeted,
    totalSpent,
    categories:   data.categories.map((c) => ({
      key:         c.key,
      label:       c.label,
      budgetedArs: c.budgetedArs,
      usedArs:     c.usedArs,
      availableArs: c.availableArs,
      percentage:  c.percentage,
      isOverspent: c.isOverspent,
      isAuto:      c.isAuto,
    })),
  });
}
