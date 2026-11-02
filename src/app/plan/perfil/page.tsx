import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveFinance } from "@/lib/plan/page";
import { PlanHeader } from "@/components/plan/plan-ui";
import { ProfileClient } from "@/components/plan/profile-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const { id: userId } = session.user;
  const { householdId } = await resolveActiveFinance(session);

  const [user, household] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.household.findUnique({
      where: { id: householdId },
      include: {
        owner: { select: { id: true, name: true, avatarColor: true, role: true } },
        members: { include: { user: { select: { id: true, name: true, avatarColor: true, role: true } } } },
      },
    }),
  ]);
  if (!user || !household) redirect("/login");
  // Quien tiene acceso a la finanza activa: el dueño y los miembros (no los usuarios cuyo hogar por defecto es este).
  const people = new Map<string, { id: string; name: string; avatarColor: string; role: string }>();
  if (household.owner) people.set(household.owner.id, household.owner);
  for (const m of household.members) people.set(m.user.id, m.user);

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
        members={[...people.values()]}
      />
    </>
  );
}
