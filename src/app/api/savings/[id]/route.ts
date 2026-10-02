import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return unauthorized();
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { date, description, type, currency, amount, platform } = body;

    const existing = await prisma.saving.findFirst({
      where: { id, householdId: session.user.householdId },
    });
    if (!existing) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (date)        data.date        = new Date(date);
    if (description) data.description = description.trim();
    if (type)        data.type        = type;
    if (currency)    data.currency    = currency;
    if (amount != null) {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
      }
      data.amount = parsedAmount;
    }
    if (platform !== undefined) data.platform = platform?.trim() || null;

    const saving = await prisma.saving.update({ where: { id }, data });

    return NextResponse.json({
      id:          saving.id,
      date:        saving.date.toISOString(),
      description: saving.description,
      type:        saving.type,
      currency:    saving.currency,
      amount:      Number(saving.amount),
      amountArs:   saving.amountArs != null ? Number(saving.amountArs) : null,
      platform:    saving.platform,
      createdAt:   saving.createdAt.toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return unauthorized();
  }

  try {
    const { id } = await params;

    const existing = await prisma.saving.findFirst({
      where: { id, householdId: session.user.householdId },
    });
    if (!existing) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    await prisma.saving.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
