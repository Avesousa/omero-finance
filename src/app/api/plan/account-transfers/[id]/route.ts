import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, withSession } from "@/lib/plan/server";
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
 return withSession(req, "delete", async (ctx) => {
  const row = await prisma.planAccountTransfer.findUnique({ where: { id: (await params).id }, include: { from: true, to: true } });
  if (!row) throw new ApiError("No encontrado", 404);
  await ctx.assert(row.from, "read"); await ctx.assert(row.to, "read");
  if (row.createdByUserId !== ctx.userId) throw new ApiError("Solo el dueño puede deshacer la transferencia", 403);
  await ctx.assert(row.from, "update"); await ctx.assert(row.to, "update");
  await prisma.planAccountTransfer.delete({ where: { id: row.id } }); return NextResponse.json({ ok: true });
 });
}
