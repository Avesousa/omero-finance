import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, type Role } from "@/lib/plan/access";
import { ApiError, readBody, v, withUser } from "@/lib/plan/server";

type Params = { params: Promise<{ id: string }> };

/** GET /api/plan/finances/[id]/members — el dueño primero y después los miembros. Cualquier miembro puede verlos. */
export async function GET(req: NextRequest, { params }: Params) {
  return withUser(req, async ({ assert }) => {
    const { id } = await params;
    await assert({ householdId: id }, "read");
    const finance = await prisma.household.findUniqueOrThrow({
      where: { id },
      select: { ownerUserId: true, members: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } } },
    });
    const owner = finance.ownerUserId
      ? await prisma.user.findUnique({ where: { id: finance.ownerUserId }, select: { id: true, name: true, email: true } })
      : null;

    const rows = finance.members
      .filter((m) => m.userId !== finance.ownerUserId)
      .map((m) => ({ userId: m.user.id, name: m.user.name, email: m.user.email, role: m.role as Role, isOwner: false }));
    if (owner) rows.unshift({ userId: owner.id, name: owner.name, email: owner.email, role: "ADMIN", isOwner: true });
    return NextResponse.json({ members: rows });
  });
}

/**
 * POST /api/plan/finances/[id]/members — agrega a un usuario YA registrado por correo.
 * Body: { email, role }. Solo ADMIN. La finanza personal no se comparte (422).
 */
export async function POST(req: NextRequest, { params }: Params) {
  return withUser(req, async ({ assert }) => {
    const { id } = await params;
    const body = await readBody(req);
    await assert({ householdId: id }, "manage");
    const finance = await prisma.household.findUniqueOrThrow({ where: { id }, select: { kind: true, ownerUserId: true } });
    if (finance.kind === "PERSONAL") throw new ApiError("La finanza personal no se comparte. Creá un Hogar.", 422);

    const email = v.text(body.email, "El correo", 160).toLowerCase();
    const role = v.oneOf(body.role ?? "EDITOR", ROLES, "Rol");

    const target = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, name: true, email: true },
    });
    if (!target) throw new ApiError("No hay un usuario con ese correo. Las invitaciones llegan pronto.", 404);

    const already = target.id === finance.ownerUserId
      || (await prisma.financeMember.findUnique({ where: { userId_householdId: { userId: target.id, householdId: id } } }));
    if (already) throw new ApiError("Esa persona ya es miembro", 409);

    await prisma.financeMember.create({ data: { userId: target.id, householdId: id, role } });
    return NextResponse.json(
      { member: { userId: target.id, name: target.name, email: target.email, role, isOwner: false } },
      { status: 201 },
    );
  });
}
