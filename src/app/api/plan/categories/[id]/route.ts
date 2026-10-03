import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, readBody, v, withSession } from "@/lib/plan/server";

type Params = { params: Promise<{ id: string }> };

async function findCategory(householdId: string, id: string) {
  const category = await prisma.planCategory.findFirst({ where: { id, householdId } });
  if (!category) throw new ApiError("No encontrada", 404);
  return category;
}

/** PATCH /api/plan/categories/[id] — Body: { name?, isArchived? } */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withSession(req, async ({ householdId }) => {
    const { id } = await params;
    const body = await readBody(req);
    const category = await findCategory(householdId, id);

    const data: { name?: string; isArchived?: boolean } = {};
    if (body.name !== undefined) {
      const name = v.text(body.name, "El nombre", 40);
      const clash = await prisma.planCategory.findFirst({
        where: { householdId, kind: category.kind, id: { not: id }, name: { equals: name, mode: "insensitive" } },
      });
      if (clash) throw new ApiError("Ya existe una categoría con ese nombre", 409);
      data.name = name;
    }
    if (body.isArchived !== undefined) {
      if (category.systemKey) throw new ApiError("Esta categoría no se puede ocultar");
      data.isArchived = body.isArchived === true;
    }

    await prisma.planCategory.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  });
}

/**
 * DELETE /api/plan/categories/[id]
 * Si la categoría ya se usó, se oculta (para no perder el historial);
 * si nunca se usó, se borra.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  return withSession(req, async ({ householdId }) => {
    const { id } = await params;
    const category = await findCategory(householdId, id);
    if (category.systemKey) throw new ApiError("Esta categoría no se puede borrar");

    const [entries, recurrings, budgets, purchases] = await Promise.all([
      prisma.planEntry.count({ where: { OR: [{ categoryId: id }, { targetCategoryId: id }] } }),
      prisma.planRecurring.count({ where: { OR: [{ categoryId: id }, { targetCategoryId: id }] } }),
      prisma.planBudget.count({ where: { categoryId: id } }),
      prisma.planCardPurchase.count({ where: { categoryId: id } }),
    ]);

    if (entries + recurrings + budgets + purchases > 0) {
      await prisma.planCategory.update({ where: { id }, data: { isArchived: true } });
      return NextResponse.json({ ok: true, archived: true });
    }
    await prisma.planCategory.delete({ where: { id } });
    return NextResponse.json({ ok: true, archived: false });
  });
}
