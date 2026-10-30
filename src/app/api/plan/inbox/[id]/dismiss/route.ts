import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, withSession } from "@/lib/plan/server";

type Params = { params: Promise<{ id: string }> };

/** POST /api/plan/inbox/[id]/dismiss — descarta un pago pendiente. */
export async function POST(req: NextRequest, { params }: Params) {
  return withSession(req, async ({ householdId }) => {
    const { id } = await params;
    const item = await prisma.planInboxItem.findFirst({ where: { id, householdId } });
    if (!item) throw new ApiError("No encontrado", 404);
    // updateMany con el estado en el filtro evita pisar un pago confirmado en paralelo.
    const res = await prisma.planInboxItem.updateMany({
      where: { id, householdId, status: "PENDING" },
      data: { status: "DISMISSED" },
    });
    if (res.count === 0) throw new ApiError("Este pago ya fue resuelto", 409);
    return NextResponse.json({ ok: true });
  });
}
