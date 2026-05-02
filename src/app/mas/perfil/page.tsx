import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileClient } from "@/components/profile/profile-client";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
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
    <div className="flex flex-col gap-5 px-4 py-4 max-w-lg mx-auto pb-32">
      <div className="flex items-center gap-2">
        <Link
          href="/mas"
          className="w-8 h-8 flex items-center justify-center rounded-xl"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
        >
          <ChevronLeft size={16} />
        </Link>
        <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          Perfil
        </h1>
      </div>

      <ProfileClient
        userId={userId}
        name={user.name}
        email={user.email}
        avatarColor={user.avatarColor}
        householdName={household.name ?? "Mi hogar"}
        householdType={household.type}
        members={household.users}
      />
    </div>
  );
}
