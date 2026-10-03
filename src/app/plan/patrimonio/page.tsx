import { BalanceClient } from "@/components/plan/balance-client";
import { planContext, type PlanSearchParams } from "@/lib/plan/page";
import { loadBalance, usdRateFor } from "@/lib/plan/server";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: PlanSearchParams }) {
  const { householdId, period } = await planContext(searchParams);
  const [items, usdRate] = await Promise.all([loadBalance(householdId), usdRateFor(householdId, period)]);
  return <BalanceClient items={items} period={period} usdRate={usdRate} />;
}
