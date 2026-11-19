import { MovementsClient } from "@/components/plan/movements-client";
import { planPageData, type PlanSearchParams } from "@/lib/plan/page";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: PlanSearchParams }) {
 return <MovementsClient data={await planPageData(searchParams)} />;
}
