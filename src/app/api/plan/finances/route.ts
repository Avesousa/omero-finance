import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveFinance } from "@/lib/plan/access";
import { DEFAULT_SHARED_COLOR, isPaletteKey, listFinancesFor, toFinanceDTO } from "@/lib/plan/finances";
import { ApiError, ensurePlanDefaults, readBody, v, withUser } from "@/lib/plan/server";

const SHARED_TYPES = ["SHARED", "ORGANIZATION", "MULTIPLE"] as const;

/** GET /api/plan/finances — las finanzas del usuario y la que está activa. */
export async function GET(req: NextRequest) {
  return withUser(req, async ({ userId, defaultHouseholdId }) => {
    const finances = await listFinancesFor(userId);
    // La activa es la que pide el cliente si es válida; si no, la de por defecto del usuario.
    const requested = req.headers.get("x-finance-id");
    let activeId: string;
    try {
      activeId = (await resolveFinance(userId, requested, defaultHouseholdId)).householdId;
    } catch {
      activeId = (await resolveFinance(userId, null, defaultHouseholdId)).householdId;
    }
    return NextResponse.json({ finances, activeId });
  });
}

/**
 * POST /api/plan/finances — crea un Hogar (finanza SHARED) del que el usuario es dueño y ADMIN.
 * Body: { name, color?, type? }
 */
export async function POST(req: NextRequest) {
  return withUser(req, async ({ userId }) => {
    const body = await readBody(req);
    const name = v.text(body.name, "El nombre", 60);
    const color = body.color === undefined || body.color === null ? DEFAULT_SHARED_COLOR : body.color;
    if (!isPaletteKey(color)) throw new ApiError("Color inválido");
    const type = body.type === undefined ? "SHARED" : v.oneOf(body.type, SHARED_TYPES, "Tipo");

    const mine = await listFinancesFor(userId);
    if (mine.some((f) => f.name.trim().toLowerCase() === name.toLowerCase())) {
      throw new ApiError("Ya tenés una finanza con ese nombre", 409);
    }

    const created = await prisma.household.create({
      data: {
        name, type, kind: "SHARED", color, ownerUserId: userId,
        members: { create: { userId, role: "ADMIN" } },
      },
      select: { id: true, name: true, kind: true, color: true, ownerUserId: true, _count: { select: { members: true } } },
    });
    await ensurePlanDefaults(created.id);
    return NextResponse.json({ finance: toFinanceDTO(created, userId, "ADMIN") }, { status: 201 });
  });
}
