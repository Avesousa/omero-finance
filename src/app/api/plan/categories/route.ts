import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, KINDS, readBody, v, withSession } from "@/lib/plan/server";

/** POST /api/plan/categories — Body: { kind, name } */
export async function POST(req: NextRequest) {
  return withSession(req, async ({ householdId }) => {
    const body = await readBody(req);
    const kind = v.oneOf(body.kind, KINDS, "Tipo");
    const name = v.text(body.name, "El nombre", 40);

    const existing = await prisma.planCategory.findFirst({
      where: { householdId, kind, name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      if (!existing.isArchived) throw new ApiError("Ya existe una categoría con ese nombre", 409);
      // Si estaba archivada, la recuperamos en vez de duplicarla.
      await prisma.planCategory.update({ where: { id: existing.id }, data: { isArchived: false } });
      return NextResponse.json({ id: existing.id }, { status: 201 });
    }

    const last = await prisma.planCategory.findFirst({
      where: { householdId, kind, systemKey: null },
      orderBy: { sortOrder: "desc" },
    });
    const created = await prisma.planCategory.create({
      data: { householdId, kind, name, sortOrder: (last?.sortOrder ?? 0) + 1 },
    });
    return NextResponse.json({ id: created.id }, { status: 201 });
  });
}
