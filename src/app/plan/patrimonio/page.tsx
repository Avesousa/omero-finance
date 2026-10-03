import { BalanceClient } from "@/components/plan/balance-client";
import { planContext, type PlanSearchParams } from "@/lib/plan/page";
import { loadBalance, loadCardStatements, loadLoans, usdRateFor } from "@/lib/plan/server";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: PlanSearchParams }) {
  const { householdId, period } = await planContext(searchParams);
  const [items, loans, cardData, usdRate] = await Promise.all([
    loadBalance(householdId),
    loadLoans(householdId),
    loadCardStatements(householdId),
    usdRateFor(householdId, period),
  ]);
  return (
    <BalanceClient
      items={items}
      loans={loans}
      cards={cardData.cards}
      statements={cardData.statements}
      period={period}
      usdRate={usdRate}
    />
  );
}
