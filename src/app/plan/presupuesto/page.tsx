import { BudgetClient } from "@/components/plan/budget-client";
import { planPageData, type PlanSearchParams } from "@/lib/plan/page";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: PlanSearchParams }) {
  const data = await planPageData(searchParams);
  // La clave descarta lo que se estaba editando al cambiar de mes.
  return <BudgetClient key={data.period} data={data} />;
}
