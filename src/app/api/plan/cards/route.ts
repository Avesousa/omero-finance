import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readBody, withSession } from "@/lib/plan/server";
import { cardFields } from "@/lib/plan/cards";

/** POST /api/plan/cards — agrega una tarjeta. Body: { entity, cardType, name?, ownerName? } */
export async function POST(req: NextRequest) {
  return withSession(req, "create", async ({ householdId, userId }) => {
    const data = cardFields(await readBody(req));
    const card = await prisma.card.create({ data: { householdId, ownerUserId: userId, ...data } });
    return NextResponse.json({ id: card.id }, { status: 201 });
  });
}

export async function GET(req: NextRequest) {
 return withSession(req, "read", async (ctx) => {
  const cards = await prisma.card.findMany({ where: ctx.finance.kind === "PERSONAL" ? { OR: [{ householdId: ctx.householdId }, { ownerUserId: ctx.userId }] } : { householdId: ctx.householdId }, include: { household: { select: { name: true } }, planStatements: { where: { isPaid: false }, select: { totalArs: true, usdAmount: true } } }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ cards: cards.map(({ household, planStatements, ...c }) => ({ ...c, unpaidArs: planStatements.reduce((s, st) => s + Number(st.totalArs), 0), unpaidUsd: planStatements.reduce((s, st) => s + Number(st.usdAmount ?? 0), 0), unpaidStatements: planStatements.length, financeName: household.name, isOwner: c.ownerUserId === ctx.userId })) });
 });
}
