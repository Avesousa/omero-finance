import Link from "next/link";
import { CardsClient } from "@/components/plan/cards-client";
import { planPageData, type PlanSearchParams } from "@/lib/plan/page";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: PlanSearchParams }) {
  const data = await planPageData(searchParams);
  return <><Link href="/plan/recursos-tarjetas" className="text-sm underline">Mis tarjetas y finanzas</Link><CardsClient data={data} /></>;
}
