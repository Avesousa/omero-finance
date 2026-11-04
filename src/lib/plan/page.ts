import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession, type AuthSession } from "@/lib/auth";
import { resolveFinance } from "./access";
import { ApiError } from "./api-error";
import { loadPlan, resolvePeriod, type PlanData } from "./server";

export type PlanSearchParams = Promise<{ period?: string | string[] }>;

export const FINANCE_COOKIE = "omero_finance";

/**
 * Finanza activa de la web: la de la cookie `omero_finance` si el usuario todavía tiene acceso;
 * si no (o sin cookie), la de por defecto (`User.householdId`). Nunca confía en la cookie sin validarla.
 */
export async function resolveActiveFinance(session: AuthSession) {
  const saved = (await cookies()).get(FINANCE_COOKIE)?.value ?? null;
  try {
    return await resolveFinance(session.user.id, saved, session.user.householdId);
  } catch (err) {
    if (err instanceof ApiError && saved) return resolveFinance(session.user.id, null, session.user.householdId);
    throw err;
  }
}

/** Sesión + finanza activa + mes pedido en la URL. Redirige a /login si no hay sesión. */
export async function planContext(searchParams: PlanSearchParams) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const active = await resolveActiveFinance(session);
  const period = resolvePeriod((await searchParams).period);
  return { householdId: active.householdId, role: active.role, finance: active.finance, period };
}

/** Lo que usan casi todas las pantallas de /plan: los datos del mes pedido. */
export async function planPageData(searchParams: PlanSearchParams): Promise<PlanData> {
  const { householdId, role, period } = await planContext(searchParams);
  return loadPlan(householdId, period, role);
}
