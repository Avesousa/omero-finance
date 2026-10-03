import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { loadPlan, resolvePeriod, type PlanData } from "./server";

export type PlanSearchParams = Promise<{ period?: string | string[] }>;

/** Sesión + mes pedido en la URL. Redirige a /login si no hay sesión. */
export async function planContext(searchParams: PlanSearchParams) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const period = resolvePeriod((await searchParams).period);
  return { householdId: session.user.householdId, period };
}

/** Lo que usan casi todas las pantallas de /plan: los datos del mes pedido. */
export async function planPageData(searchParams: PlanSearchParams): Promise<PlanData> {
  const { householdId, period } = await planContext(searchParams);
  return loadPlan(householdId, period);
}
