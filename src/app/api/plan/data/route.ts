import { NextRequest, NextResponse } from "next/server";
import { currentPeriod } from "@/lib/plan/core";
import { loadPlan, v, withSession } from "@/lib/plan/server";

/**
 * GET /api/plan/data?period=YYYY-MM — todo lo del mes (lo mismo que reciben las pantallas web).
 * Lo usa la app del teléfono con `Authorization: Bearer <token de sesión>`.
 */
export async function GET(req: NextRequest) {
  return withSession(req, async ({ householdId }) => {
    const raw = new URL(req.url).searchParams.get("period");
    const period = raw ? v.nearPeriod(raw) : currentPeriod();
    return NextResponse.json(await loadPlan(householdId, period));
  });
}
