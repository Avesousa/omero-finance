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

    const statementData = {
      ...(body.isPaid !== undefined && {
        isPaid:        body.isPaid,
        paidAt:        body.isPaid ? new Date() : null,
        paymentSource: body.isPaid ? (body.paymentSource ?? null) : null,
      }),
      ...(body.totalAmountArs !== undefined && {
        totalAmountArs: parseFloat(body.totalAmountArs),
        amountToPay:    parseFloat(body.totalAmountArs),
      }),
      ...(body.usdAmount      !== undefined && { usdAmount: body.usdAmount ? parseFloat(body.usdAmount) : null }),
      ...(body.dueDate        !== undefined && { dueDate: new Date(body.dueDate) }),
      ...(body.minimumPayment !== undefined && { minimumPayment: parseFloat(body.minimumPayment) }),
      ...(body.customAmount   !== undefined && {
        customAmount: parseFloat(body.customAmount),
        amountToPay:  parseFloat(body.customAmount),
        payMinimum:   true,
      }),
      ...(body.payMinimum !== undefined && typeof body.payMinimum === "boolean" && {
        payMinimum: body.payMinimum,
      }),
      ...("committedOverride" in body && {
        committedOverride: body.committedOverride != null ? parseFloat(body.committedOverride) : null,
      }),
    };

    if (body.isPaid && body.accountId && body.deductAmount !== undefined) {
      const deductAmt = parseFloat(body.deductAmount);
      const [record] = await prisma.$transaction([
        prisma.creditCardStatement.update({ where: { id }, data: statementData }),
        prisma.account.update({
          where: { id: body.accountId },
          data: { balance: { decrement: deductAmt } },
        }),
      ]);
      return NextResponse.json({ ok: true, isPaid: record.isPaid });
    }

    const record = await prisma.creditCardStatement.update({ where: { id }, data: statementData });
    return NextResponse.json({ ok: true, isPaid: record.isPaid });
  } catch (err) {
    console.error("[api/tdc PATCH]", err);
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
    await prisma.creditCardStatement.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/tdc DELETE]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
