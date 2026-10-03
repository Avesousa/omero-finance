import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readBody, withSession } from "@/lib/plan/server";
import { cardFields } from "@/lib/plan/cards";

/** POST /api/plan/cards — agrega una tarjeta. Body: { entity, cardType, ownerName } */
export async function POST(req: NextRequest) {
  return withSession(req, async ({ householdId }) => {
    const data = cardFields(await readBody(req));
    const card = await prisma.card.create({ data: { householdId, ...data } });
    return NextResponse.json({ id: card.id }, { status: 201 });
  });
}
