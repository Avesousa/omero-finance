import { ResourcesClient } from "@/components/plan/resources-client";
import { planContext, type PlanSearchParams } from "@/lib/plan/page";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: PlanSearchParams }) {
 const ctx = await planContext(searchParams);
 return <ResourcesClient key={ctx.householdId} kind="accounts" financeId={ctx.householdId} canWrite={ctx.role !== "VIEWER"} />;
}
