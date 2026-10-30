import { NextRequest, NextResponse } from "next/server";
import { reportError } from "@/lib/plan/errors";
import { readBody, v, withSession } from "@/lib/plan/server";

/** POST /api/plan/errors — la app reporta un error propio para que el admin lo vea. */
export async function POST(req: NextRequest) {
  return withSession(req, async ({ householdId, userId }) => {
    const body = await readBody(req);
    const source = v.text(body.source, "El origen", 40);
    const code = v.text(body.code, "El código", 80);
    const message = v.text(body.message, "El mensaje", 1000);
    const saved = await reportError({ householdId, userId, source, code, message, context: body.context });
    return NextResponse.json({ ok: saved }, { status: 201 });
  });
}
