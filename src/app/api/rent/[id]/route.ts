import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** PATCH /api/rent/[id] — update editable fields */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body   = await req.json();

    const data: Record<string, unknown> = {};
    if (body.type        !== undefined) data.type        = body.type;
    if (body.apartment   !== undefined) data.apartment   = body.apartment;
    if (body.currency    !== undefined) data.currency    = body.currency;
    if (body.amount      !== undefined) data.amount      = parseFloat(body.amount);
    if (body.description !== undefined) data.description = body.description ?? null;
    if (body.cbuAlias    !== undefined) data.cbuAlias    = body.cbuAlias ?? null;
    if (body.month       !== undefined) data.month       = body.month;
    if (body.year        !== undefined) data.year        = body.year;

    const payment = await prisma.rentPayment.update({ where: { id }, data });
    return NextResponse.json({ ok: true, id: payment.id });
  } catch (err) {
    console.error("[api/rent PATCH]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/** DELETE /api/rent/[id] */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.rentPayment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/rent DELETE]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
