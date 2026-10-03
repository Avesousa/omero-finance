import { CategoriesClient } from "@/components/plan/categories-client";
import { planPageData, type PlanSearchParams } from "@/lib/plan/page";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: PlanSearchParams }) {
  const data = await planPageData(searchParams);
  return <CategoriesClient categories={data.categories} />;
}
