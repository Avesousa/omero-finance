import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** PATCH /api/loans/[id]/installments/[num] — toggle isPaid */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; num: string }> },
) {
  try {
    const { id: loanId, num } = await params;
    const installmentNumber   = parseInt(num, 10);

    if (isNaN(installmentNumber)) {
      return NextResponse.json({ error: "Número de cuota inválido" }, { status: 400 });
    }

    const existing = await prisma.loanInstallment.findFirst({
      where: { loanId, installmentNumber },
    });

    if (!existing) {
      return NextResponse.json({ error: "Cuota no encontrada" }, { status: 404 });
    }

    const newIsPaid = !existing.isPaid;
    const updated   = await prisma.loanInstallment.update({
      where: { id: existing.id },
      data: {
        isPaid:   newIsPaid,
        paidDate: newIsPaid ? new Date() : null,
      },
    });

    return NextResponse.json({
      ...updated,
      amount:   Number(updated.amount),
      dueDate:  updated.dueDate.toISOString(),
      paidDate: updated.paidDate ? updated.paidDate.toISOString() : null,
    });
  } catch (err) {
    console.error("[api/loans/installments PATCH]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
