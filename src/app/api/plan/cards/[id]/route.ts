import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readBody, withSession } from "@/lib/plan/server";
import { cardFields } from "@/lib/plan/cards";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/plan/cards/[id] — Body: { entity, cardType, ownerName } */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withSession(req, "update", async (ctx) => {
    const { id } = await params;
    await ctx.assert(await prisma.card.findUnique({ where: { id } }), "update");
    await prisma.card.update({ where: { id }, data: cardFields(await readBody(req)) });
    return NextResponse.json({ ok: true });
  });
}

/**
 * DELETE /api/plan/cards/[id]
 * Si la tarjeta tiene compras o resúmenes cargados en Plan simple, no se borra
 * salvo que venga `?confirm=1`; en ese caso se borran junto con ella.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  return withSession(req, "delete", async (ctx) => {
    const { id } = await params;
    await ctx.assert(await prisma.card.findUnique({ where: { id } }), "delete");
    const confirmed = new URL(req.url).searchParams.get("confirm") === "1";

    const [purchases, statements] = await Promise.all([
      prisma.planCardPurchase.count({ where: { cardId: id } }),
      prisma.planCardStatement.count({ where: { cardId: id } }),
    ]);
    if (purchases + statements > 0 && !confirmed) {
      return NextResponse.json(
        { error: "La tarjeta tiene compras o resúmenes cargados", purchases, statements },
        { status: 409 },
      );
    }

    await prisma.$transaction([
      prisma.planCardPurchase.deleteMany({ where: { cardId: id } }),
      prisma.planCardStatement.deleteMany({ where: { cardId: id } }),
      prisma.card.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true, purchases, statements });
  });
}
