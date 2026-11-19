import { NextRequest, NextResponse } from "next/server";
import { recentAccountMovements } from "@/lib/plan/accounts";
import { withSession } from "@/lib/plan/server";

/** GET /api/plan/account-movements?limit=8 — últimos movimientos de tus cuentas (todas las finanzas visibles). */
export async function GET(req: NextRequest) {
  return withSession(req, "read", async (ctx) => {
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? 8);
    return NextResponse.json({ movements: await recentAccountMovements(ctx, Number.isFinite(limit) ? limit : 8) });
  });
}
