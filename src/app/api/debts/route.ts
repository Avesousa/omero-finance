import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HOUSEHOLD_ID, AVELINO_ID } from "../../../../prisma/constants";

export async function GET() {
  try {
    const debts = await prisma.debt.findMany({
      where: { householdId: HOUSEHOLD_ID },
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

    const debt = await prisma.debt.create({
      data: {
        householdId: HOUSEHOLD_ID,
        createdById: AVELINO_ID,
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
