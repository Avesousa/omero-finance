import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function deriveName(entity: string, cardType: string, ownerName: string) {
  return `${cardType} ${entity} ${ownerName}`;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { entity, cardType, ownerName } = await req.json();
  if (!entity?.trim() || !cardType?.trim() || !ownerName?.trim()) {
    return NextResponse.json({ error: "Entidad, tipo y dueño son requeridos" }, { status: 400 });
  }

  const name = deriveName(entity.trim(), cardType.trim(), ownerName.trim());

  const card = await prisma.card.update({
    where: { id },
    data: {
      name,
      entity:    entity.trim(),
      cardType:  cardType.trim(),
      ownerName: ownerName.trim(),
    },
    select: { id: true, name: true, entity: true, cardType: true, ownerName: true },
  });
  return NextResponse.json(card);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.card.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
