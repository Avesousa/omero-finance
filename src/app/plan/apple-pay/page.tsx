import { ApplePayClient } from "@/components/plan/apple-pay-client";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
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
  // La dirección pública de la app (la misma con la que se abrió), para armar el atajo.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const endpoint = `${proto}://${host}/api/plan/inbox/apple-pay`;
  return <ApplePayClient tokens={tokens} endpoint={endpoint} />;
}
