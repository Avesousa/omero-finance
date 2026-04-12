import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";

function deriveName(entity: string, cardType: string, ownerName: string) {
  return `${cardType} ${entity} ${ownerName}`;
}

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return unauthorized();
  }

  const cards = await prisma.card.findMany({
    where: { householdId: session.user.householdId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, entity: true, cardType: true, ownerName: true },
  });

  return NextResponse.json(cards);
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return unauthorized();
  }

  const { entity, cardType, ownerName } = await req.json();
  if (!entity?.trim() || !cardType?.trim() || !ownerName?.trim()) {
    return NextResponse.json({ error: "Entidad, tipo y dueño son requeridos" }, { status: 400 });
  }

  const name = deriveName(entity.trim(), cardType.trim(), ownerName.trim());

  const card = await prisma.card.create({
    data: {
      householdId: session.user.householdId,
      name,
      entity:    entity.trim(),
      cardType:  cardType.trim(),
      ownerName: ownerName.trim(),
    },
    select: { id: true, name: true, entity: true, cardType: true, ownerName: true },
  });
  return NextResponse.json(card, { status: 201 });
}
