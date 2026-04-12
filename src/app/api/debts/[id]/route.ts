import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body   = await req.json();

    const data: Record<string, unknown> = {};
    if (body.date        !== undefined) data.date        = new Date(body.date);
    if (body.concept     !== undefined) data.concept     = body.concept.trim();
    if (body.debtor      !== undefined) data.debtor      = body.debtor.trim();
    if (body.currency    !== undefined) data.currency    = body.currency;
    if (body.totalAmount !== undefined) data.totalAmount = parseFloat(body.totalAmount);
    if (body.amountPaid  !== undefined) data.amountPaid  = parseFloat(body.amountPaid);
    if (body.status      !== undefined) data.status      = body.status;

    const debt = await prisma.debt.update({ where: { id }, data });

    return NextResponse.json({
      ...debt,
      totalAmount:        Number(debt.totalAmount),
      totalArs:           debt.totalArs ? Number(debt.totalArs) : null,
      dollarRateSnapshot: debt.dollarRateSnapshot ? Number(debt.dollarRateSnapshot) : null,
      amountPaid:         Number(debt.amountPaid),
      date:               debt.date.toISOString(),
      createdAt:          debt.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("[api/debts PATCH]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.debt.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/debts DELETE]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
