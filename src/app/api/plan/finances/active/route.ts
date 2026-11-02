import { NextRequest, NextResponse } from "next/server";
import { canAccess } from "@/lib/plan/access";
import { ApiError, readBody, v, withUser } from "@/lib/plan/server";

/**
 * POST /api/plan/finances/active — web: fija la finanza activa en la cookie `omero_finance`.
 * Body: { id }. Valida acceso (read) antes de guardarla. La cookie no es httpOnly a propósito:
 * es solo una preferencia de selección; el servidor igual la valida en cada request.
 */
export async function POST(req: NextRequest) {
  return withUser(req, async ({ userId }) => {
    const body = await readBody(req);
    const id = v.text(body.id, "La finanza", 60);
    if (!(await canAccess({ id: userId }, { householdId: id }, "read"))) {
      throw new ApiError("No tenés acceso a esa finanza", 403);
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set("omero_finance", id, {
      httpOnly: false, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  });
}
