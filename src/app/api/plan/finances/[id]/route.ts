import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPaletteKey, listFinancesFor } from "@/lib/plan/finances";
import { ApiError, readBody, v, withUser } from "@/lib/plan/server";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/plan/finances/[id] — Body: { name?, color? }. Solo ADMIN. */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withUser(req, async ({ userId, assert }) => {
    const { id } = await params;
    const body = await readBody(req);
    await assert({ householdId: id }, "manage");
    const finance = await prisma.household.findUniqueOrThrow({ where: { id } });

    const data: { name?: string; color?: string } = {};
    if (body.name !== undefined) {
      const name = v.text(body.name, "El nombre", 60);
      const mine = await listFinancesFor(userId);
      if (mine.some((f) => f.id !== id && f.name.trim().toLowerCase() === name.toLowerCase())) {
        throw new ApiError("Ya tenés una finanza con ese nombre", 409);
      }
      data.name = name;
    }
    if (body.color !== undefined) {
      if (!isPaletteKey(body.color)) throw new ApiError("Color inválido");
      if (finance.kind === "PERSONAL") throw new ApiError("La finanza personal usa el color de Omero", 422);
      data.color = body.color;
    }

    if (Object.keys(data).length > 0) await prisma.household.update({ where: { id }, data });
    const updated = (await listFinancesFor(userId)).find((f) => f.id === id);
    return NextResponse.json({ finance: updated });
  });
}
