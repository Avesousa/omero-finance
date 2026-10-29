import { ApplePayClient } from "@/components/plan/apple-pay-client";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const rows = await prisma.planApiToken.findMany({
    where: { householdId: session.user.householdId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  const tokens = rows.map((t) => ({
    id: t.id,
    name: t.name,
    createdAt: t.createdAt.toISOString(),
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
  }));
  return <ApplePayClient tokens={tokens} />;
}
