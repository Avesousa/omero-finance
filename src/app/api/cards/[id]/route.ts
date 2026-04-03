import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  }
  try {
    const card = await prisma.card.update({
      where: { id },
      data: { name: name.trim() },
      select: { id: true, name: true },
    });
    return NextResponse.json(card);
  } catch {
    return NextResponse.json({ error: "Ya existe una tarjeta con ese nombre" }, { status: 409 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.card.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
