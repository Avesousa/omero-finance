import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return unauthorized();
  }

  try {
    const { householdId } = session.user;
    const debts = await prisma.debt.findMany({
      where: { householdId },
      orderBy: { date: "desc" },
    });

    const serialized = debts.map((debt) => ({
      ...debt,
      totalAmount:        Number(debt.totalAmount),
      totalArs:           debt.totalArs ? Number(debt.totalArs) : null,
      dollarRateSnapshot: debt.dollarRateSnapshot ? Number(debt.dollarRateSnapshot) : null,
      amountPaid:         Number(debt.amountPaid),
      date:               debt.date.toISOString(),
      createdAt:          debt.createdAt.toISOString(),
    }));

    return NextResponse.json(serialized);
  } catch (err) {
    console.error("[api/debts GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return unauthorized();
  }

  try {
    const body = await req.json();
    const { date, concept, debtor, currency, totalAmount, amountPaid } = body;

    if (!date || !concept || !debtor || !totalAmount) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const totalAmountNum = parseFloat(totalAmount);
    const amountPaidNum  = amountPaid ? parseFloat(amountPaid) : 0;

    if (isNaN(totalAmountNum)) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    const { householdId, id: createdById } = session.user;

    const debt = await prisma.debt.create({
      data: {
        householdId,
        createdById,
        date:        new Date(date),
        concept:     concept.trim(),
        debtor:      debtor.trim(),
        currency:    currency ?? "ARS",
        totalAmount: totalAmountNum,
        amountPaid:  amountPaidNum,
        status:      "ACTIVE",
      },
    });

    return NextResponse.json(
      {
        ...debt,
        totalAmount:        Number(debt.totalAmount),
        totalArs:           debt.totalArs ? Number(debt.totalArs) : null,
        dollarRateSnapshot: debt.dollarRateSnapshot ? Number(debt.dollarRateSnapshot) : null,
        amountPaid:         Number(debt.amountPaid),
        date:               debt.date.toISOString(),
        createdAt:          debt.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[api/debts POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
