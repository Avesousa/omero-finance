import { LoansClient } from "@/components/plan/loans-client";
import { planPageData, type PlanSearchParams } from "@/lib/plan/page";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: PlanSearchParams }) {
  const data = await planPageData(searchParams);
  return <LoansClient data={data} />;
}
