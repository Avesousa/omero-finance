import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, roleIn } from "@/lib/plan/access";
import { countAdmins, ensurePersonalFinance } from "@/lib/plan/finances";
import { ApiError, readBody, v, withUser } from "@/lib/plan/server";

type Params = { params: Promise<{ id: string; userId: string }> };

const LAST_ADMIN = "Tiene que quedar al menos un administrador";

/** PATCH /api/plan/finances/[id]/members/[userId] — Body: { role }. Solo ADMIN; no se le cambia el rol al dueño. */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withUser(req, async ({ assert }) => {
    const { id, userId } = await params;
    const body = await readBody(req);
    await assert({ householdId: id }, "manage");
    const role = v.oneOf(body.role, ROLES, "Rol");

    const finance = await prisma.household.findUniqueOrThrow({ where: { id }, select: { id: true, ownerUserId: true } });
    if (finance.ownerUserId === userId) throw new ApiError("No se puede cambiar el rol del dueño", 409);

    const member = await prisma.financeMember.findUnique({ where: { userId_householdId: { userId, householdId: id } } });
    if (!member) throw new ApiError("No encontrado", 404);
    if (member.role === "ADMIN" && role !== "ADMIN" && (await countAdmins(finance)) <= 1) {
      throw new ApiError(LAST_ADMIN, 409);
    }

    const updated = await prisma.financeMember.update({
      where: { id: member.id }, data: { role }, include: { user: { select: { name: true, email: true } } },
    });
    return NextResponse.json({
      member: { userId, name: updated.user.name, email: updated.user.email, role: updated.role, isOwner: false },
    });
  });
}

/**
 * DELETE /api/plan/finances/[id]/members/[userId] — un ADMIN quita a alguien, o cada quien se sale solo.
 * No se quita al dueño ni al último administrador.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  return withUser(req, async (ctx) => {
    const { id, userId } = await params;
    const finance = await prisma.household.findUnique({ where: { id }, select: { id: true, ownerUserId: true } });
    if (!finance) throw new ApiError("No encontrado", 404);

    const mine = await roleIn(ctx.userId, finance);
    if (!mine) throw new ApiError("No encontrado", 404);
    const isSelf = userId === ctx.userId;
    if (!isSelf) await ctx.assert({ householdId: id }, "manage");

    if (finance.ownerUserId === userId) throw new ApiError("No se puede quitar al dueño", 409);
    const member = await prisma.financeMember.findUnique({ where: { userId_householdId: { userId, householdId: id } } });
    if (!member) throw new ApiError("No encontrado", 404);
    if (member.role === "ADMIN" && (await countAdmins(finance)) <= 1) throw new ApiError(LAST_ADMIN, 409);

    await prisma.financeMember.delete({ where: { id: member.id } });

    // Si esa finanza era su default, vuelve a apuntar a su Personal para no quedar en una finanza ajena.
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { householdId: true } });
    if (target?.householdId === id) {
      await prisma.user.update({ where: { id: userId }, data: { householdId: await ensurePersonalFinance(userId) } });
    }
    return NextResponse.json({ ok: true });
  });
}
