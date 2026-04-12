import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getDashboardData, MONTH_NAMES, type MonthName } from "@/lib/dashboard";
import { getServerSession } from "@/lib/auth";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { TdcAlerts } from "@/components/dashboard/tdc-alerts";
import { BudgetTable } from "@/components/dashboard/budget-table";
import { EmptyState } from "@/components/dashboard/empty-state";

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const now = new Date();

  const month = (
    params.month && MONTH_NAMES.includes(params.month as MonthName)
      ? params.month
      : MONTH_NAMES[now.getMonth()]
  ) as MonthName;

  const year = params.year ? parseInt(params.year, 10) : now.getFullYear();

  const data = await getDashboardData(month, year, session.user.householdId);

  return (
    <div className="flex flex-col gap-5 px-4 py-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          Presupuesto
        </h1>
        <Suspense
          fallback={
            <div
              className="h-8 w-36 rounded-xl animate-pulse"
              style={{ backgroundColor: "var(--bg-elevated)" }}
            />
          }
        >
          <MonthSelector month={month} year={year} />
        </Suspense>
      </div>

      {!data.hasData ? (
        <EmptyState month={month} year={year} isFuture={data.isFuture} />
      ) : (
        <>
          {data.tdcAlerts.length > 0 && <TdcAlerts alerts={data.tdcAlerts} />}
          <SummaryCards data={data} />
          <BudgetTable categories={data.categories} users={data.users} />
        </>
      )}
    </div>
  );
}
