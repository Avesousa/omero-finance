import { ExportClient } from "@/components/plan/export-client";
import { buildExport, exportToMarkdown } from "@/lib/plan/export";
import { planContext, type PlanSearchParams } from "@/lib/plan/page";
import { loadBalance, loadPlan } from "@/lib/plan/server";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: PlanSearchParams }) {
  const { householdId, period } = await planContext(searchParams);
  const [data, balance] = await Promise.all([loadPlan(householdId, period), loadBalance(householdId)]);
  const summary = buildExport(data, balance);

  return (
    <ExportClient
      period={period}
      markdown={exportToMarkdown(summary)}
      json={JSON.stringify(summary, null, 2)}
    />
  );
}
