import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, withSession } from "@/lib/plan/server";

type Params = { params: Promise<{ id: string }> };

/** DELETE /api/plan/tokens/[id] — revoca la clave (deja de funcionar al instante). */
export async function DELETE(req: NextRequest, { params }: Params) {
  return withSession(req, "manage", async (ctx) => {
    const { id } = await params;
    const token = await prisma.planApiToken.findUnique({ where: { id } });
    await ctx.assert(token, "manage");
    if (!token) throw new ApiError("No encontrado", 404);
    if (!token.revokedAt) {
      await prisma.planApiToken.update({ where: { id }, data: { revokedAt: new Date() } });
    }
    return NextResponse.json({ ok: true });
  });
}
