import { Suspense } from "react";
import { getDashboardData, MONTH_NAMES, type MonthName } from "@/lib/dashboard";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { TdcAlerts } from "@/components/dashboard/tdc-alerts";
import { BudgetTable } from "@/components/dashboard/budget-table";

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const now = new Date();

  const month = (params.month && MONTH_NAMES.includes(params.month as MonthName)
    ? params.month
    : MONTH_NAMES[now.getMonth()]) as MonthName;

  const year = params.year ? parseInt(params.year, 10) : now.getFullYear();

  const data = await getDashboardData(month, year);

  return (
    <div className="flex flex-col gap-5 px-4 py-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          Presupuesto
        </h1>
        <Suspense fallback={<div className="h-8 w-36 rounded-xl animate-pulse" style={{ backgroundColor: "var(--bg-elevated)" }} />}>
          <MonthSelector month={month} year={year} />
        </Suspense>
      </div>

      {/* TDC alerts — at top if any */}
      {data.tdcAlerts.length > 0 && <TdcAlerts alerts={data.tdcAlerts} />}

      {/* Summary cards */}
      <SummaryCards data={data} />

      {/* Budget table */}
      <BudgetTable categories={data.categories} users={data.users} />
    </div>
  );
}
