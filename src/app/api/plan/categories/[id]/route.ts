import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, readBody, v, withSession, type ApiContext } from "@/lib/plan/server";

type Params = { params: Promise<{ id: string }> };

/** Carga la categoría sin filtro de finanza y la autoriza contra SU finanza. */
async function loadCategory(ctx: ApiContext, id: string, action: "update" | "delete") {
  const category = await prisma.planCategory.findUnique({ where: { id } });
  await ctx.assert(category, action);
  return category!;
}

/** PATCH /api/plan/categories/[id] — Body: { name?, isArchived? } */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withSession(req, "update", async (ctx) => {
    const { id } = await params;
    const body = await readBody(req);
    const category = await loadCategory(ctx, id, "update");

    const data: { name?: string; isArchived?: boolean } = {};
    if (body.name !== undefined) {
      const name = v.text(body.name, "El nombre", 40);
      const clash = await prisma.planCategory.findFirst({
        where: { householdId: category.householdId, kind: category.kind, id: { not: id }, name: { equals: name, mode: "insensitive" } },
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
  return withSession(req, "delete", async (ctx) => {
    const { id } = await params;
    const category = await loadCategory(ctx, id, "delete");
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
