import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { getDashboardData, MONTH_NAMES, type MonthName } from "@/lib/dashboard";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { EmptyState } from "@/components/dashboard/empty-state";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function MasDashboardPage({ searchParams }: PageProps) {
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
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link
          href="/mas"
          className="w-8 h-8 flex items-center justify-center rounded-xl"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
        >
          <ChevronLeft size={16} />
        </Link>
        <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          Dashboard mensual
        </h1>
      </div>

      {/* Month selector */}
      <div className="flex justify-end">
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

      {/* Content */}
      {!data.hasData ? (
        <EmptyState month={month} year={year} isFuture={data.isFuture} />
      ) : (
        <DashboardClient data={data} />
      )}
    </div>
  );
}
