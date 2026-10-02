import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession(req);
  } catch {
    return unauthorized();
  }

  try {
    const { id } = await params;
    const body   = await req.json();

    const data: Record<string, unknown> = {};
    if (body.counterpart   !== undefined) data.counterpart   = body.counterpart.trim();
    if (body.paymentMethod !== undefined) data.paymentMethod = body.paymentMethod?.trim() || null;
    if (body.notes         !== undefined) data.notes         = body.notes?.trim() || null;
    if (body.direction     !== undefined) data.direction     = body.direction;
    if (body.currency      !== undefined) data.currency      = body.currency;
    if (body.principal     !== undefined) data.principal     = parseFloat(body.principal);
    if (body.totalAmount   !== undefined) data.totalAmount   = parseFloat(body.totalAmount);
    if (body.interestRate  !== undefined) data.interestRate  = parseFloat(body.interestRate);
    if (body.installments  !== undefined) data.installments  = parseInt(body.installments, 10);

    const loan = await prisma.loan.update({ where: { id }, data });

    return NextResponse.json({
      ...loan,
      principal:          Number(loan.principal),
      principalArs:       loan.principalArs ? Number(loan.principalArs) : null,
      dollarRateSnapshot: loan.dollarRateSnapshot ? Number(loan.dollarRateSnapshot) : null,
      interestRate:       Number(loan.interestRate),
      totalAmount:        Number(loan.totalAmount),
      createdAt:          loan.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("[api/loans PATCH]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession(req);
  } catch {
    return unauthorized();
  }

  try {
    const { id } = await params;
    await prisma.loan.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/loans DELETE]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
