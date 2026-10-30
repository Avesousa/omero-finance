import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PlanHeader } from "@/components/plan/plan-ui";
import { ProfileClient } from "@/components/plan/profile-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const { id: userId, householdId } = session.user;

  const [user, household] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.household.findUnique({
      where: { id: householdId },
      include: { users: { select: { id: true, name: true, avatarColor: true, role: true } } },
    }),
  ]);
  if (!user || !household) redirect("/login");

  return (
    <>
      <PlanHeader title="Perfil" backHref="/plan/mas" />
      <ProfileClient
        userId={userId}
        name={user.name}
        email={user.email}
        avatarColor={user.avatarColor}
        householdName={household.name ?? "Mi hogar"}
        householdType={household.type}
        members={household.users}
      />
    </>
  );
}
