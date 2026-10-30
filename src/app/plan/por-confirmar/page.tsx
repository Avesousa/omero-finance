import { InboxClient } from "@/components/plan/inbox-client";
import { loadInbox } from "@/lib/plan/inbox";
import { planContext, type PlanSearchParams } from "@/lib/plan/page";
import { loadPlan } from "@/lib/plan/server";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: PlanSearchParams }) {
  const { householdId, period } = await planContext(searchParams);
  const [data, items] = await Promise.all([loadPlan(householdId, period), loadInbox(householdId)]);
  return <InboxClient items={items} categories={data.categories} cards={data.cards} today={data.today} />;
}
