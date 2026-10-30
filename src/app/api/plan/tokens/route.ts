import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/plan/inbox";
import { readBody, v, withSession } from "@/lib/plan/server";

/** GET /api/plan/tokens — las claves del hogar (nunca el valor de la clave). */
export async function GET(req: NextRequest) {
  return withSession(req, async ({ householdId }) => {
    const rows = await prisma.planApiToken.findMany({
      where: { householdId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(
      rows.map((t) => ({
        id: t.id,
        name: t.name,
        createdAt: t.createdAt.toISOString(),
        lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
        revokedAt: t.revokedAt?.toISOString() ?? null,
      })),
    );
  });
}

/** POST /api/plan/tokens { name } → { id, token }. La clave se devuelve una sola vez. */
export async function POST(req: NextRequest) {
  return withSession(req, async ({ householdId, userId }) => {
    const body = await readBody(req);
    const name = v.text(body.name, "El nombre", 60);
    const { token, tokenHash } = createToken();
    const row = await prisma.planApiToken.create({ data: { householdId, userId, name, tokenHash } });
    return NextResponse.json({ id: row.id, token }, { status: 201 });
  });
}
