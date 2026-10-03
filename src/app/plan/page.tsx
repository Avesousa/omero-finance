import { MonthClient } from "@/components/plan/month-client";
import { planPageData, type PlanSearchParams } from "@/lib/plan/page";

export const dynamic = "force-dynamic";

export default async function PlanPage({ searchParams }: { searchParams: PlanSearchParams }) {
  const data = await planPageData(searchParams);
  // La clave reinicia el estado del formulario de inicio al cambiar de mes.
  return <MonthClient key={`${data.period}-${data.started}`} data={data} />;
}
