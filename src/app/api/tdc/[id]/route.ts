import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** PATCH /api/tdc/[id] — toggle isPaid or update amount/dueDate */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body   = await req.json();

    const record = await prisma.creditCardStatement.update({
      where: { id },
      data: {
        ...(body.isPaid          !== undefined && { isPaid:         body.isPaid }),
        ...(body.totalAmountArs  !== undefined && {
          totalAmountArs: parseFloat(body.totalAmountArs),
          amountToPay:    parseFloat(body.totalAmountArs),
        }),
        ...(body.dueDate         !== undefined && { dueDate: new Date(body.dueDate) }),
        ...(body.minimumPayment  !== undefined && { minimumPayment: parseFloat(body.minimumPayment) }),
        ...(body.customAmount    !== undefined && {
          customAmount: parseFloat(body.customAmount),
          amountToPay:  parseFloat(body.customAmount),
        }),
      },
    });

    return NextResponse.json({ ok: true, isPaid: record.isPaid });
  } catch (err) {
    console.error("[api/tdc PATCH]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/** DELETE /api/tdc/[id] */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.creditCardStatement.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/tdc DELETE]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
