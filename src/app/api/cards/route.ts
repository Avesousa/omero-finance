import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HOUSEHOLD_ID } from "../../../../prisma/constants";

export async function GET() {
  const cards = await prisma.card.findMany({
    where: { householdId: HOUSEHOLD_ID },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json(cards);
}

export async function POST(req: Request) {
  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  }
  try {
    const card = await prisma.card.create({
      data: { householdId: HOUSEHOLD_ID, name: name.trim() },
      select: { id: true, name: true },
    });
    return NextResponse.json(card, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ya existe una tarjeta con ese nombre" }, { status: 409 });
  }
}
