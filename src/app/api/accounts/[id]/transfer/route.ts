import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HOUSEHOLD_ID } from "../../../../../../prisma/constants";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: fromAccountId } = await params;
  const { toAccountId, amount, description } = await req.json();

  const parsedAmount = parseFloat(amount);
  if (!toAccountId || isNaN(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const [from, to] = await Promise.all([
    prisma.account.findUnique({ where: { id: fromAccountId } }),
    prisma.account.findUnique({ where: { id: toAccountId } }),
  ]);

  if (!from || !to) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  // Execute transfer atomically
  const [updatedFrom, updatedTo, transfer] = await prisma.$transaction([
    prisma.account.update({
      where: { id: fromAccountId },
      data: { balance: { decrement: parsedAmount } },
    }),
    prisma.account.update({
      where: { id: toAccountId },
      data: { balance: { increment: parsedAmount } },
    }),
    prisma.accountTransfer.create({
      data: {
        householdId:   HOUSEHOLD_ID,
        fromAccountId,
        toAccountId,
        amount:        parsedAmount,
        currency:      from.currency,
        description:   description?.trim() || null,
      },
    }),
  ]);

  return NextResponse.json({
    transfer: { id: transfer.id, amount: parsedAmount, description: transfer.description },
    from: { id: updatedFrom.id, balance: Number(updatedFrom.balance) },
    to:   { id: updatedTo.id,   balance: Number(updatedTo.balance) },
  });
}
