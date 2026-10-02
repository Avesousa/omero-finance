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
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const yearStr = searchParams.get("year");

    if (!month || !yearStr) {
      return NextResponse.json({ error: "Faltan parámetros month y year" }, { status: 400 });
    }

    const year = parseInt(yearStr, 10);
    if (isNaN(year)) {
      return NextResponse.json({ error: "year inválido" }, { status: 400 });
    }

    const { householdId } = session.user;

    const expenses = await prisma.personalExpense.findMany({
      where: { householdId, month, year },
      orderBy: { createdAt: "asc" },
    });

    const serialized = expenses.map((e) => ({
      id:                 e.id,
      householdId:        e.householdId,
      userId:             e.userId,
      createdById:        e.createdById,
      month:              e.month,
      year:               e.year,
      concept:            e.concept,
      cardName:           e.cardName ?? null,
      currency:           e.currency as "ARS" | "USD",
      amount:             Number(e.amount),
      amountArs:          e.amountArs ? Number(e.amountArs) : null,
      dollarRateSnapshot: e.dollarRateSnapshot ? Number(e.dollarRateSnapshot) : null,
      isPaid:             e.isPaid,
      createdAt:          e.createdAt.toISOString(),
    }));

    return NextResponse.json(serialized);
  } catch (err) {
    console.error("[api/personal-expenses GET]", err);
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
    const { concept, currency, amount, cardName, isPaid, month, year } = body;

    if (!concept || !currency || !month || !year) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    const { householdId, id: userId } = session.user;

    let amountArs: number | undefined;
    let dollarRateSnapshot: number | undefined;
    if (currency === "USD") {
      const rate = await prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } });
      dollarRateSnapshot = rate ? Number(rate.usdArs) : undefined;
      if (dollarRateSnapshot) amountArs = amountNum * dollarRateSnapshot;
    }

    const expense = await prisma.personalExpense.create({
      data: {
        householdId,
        userId,
        createdById: userId,
        month,
        year: parseInt(year, 10),
        concept: concept.trim(),
        cardName: cardName?.trim() || undefined,
        currency,
        amount: amountNum,
        amountArs,
        dollarRateSnapshot,
        isPaid: isPaid ?? true,
      },
    });

    return NextResponse.json(
      {
        id:                 expense.id,
        householdId:        expense.householdId,
        userId:             expense.userId,
        createdById:        expense.createdById,
        month:              expense.month,
        year:               expense.year,
        concept:            expense.concept,
        cardName:           expense.cardName ?? null,
        currency:           expense.currency as "ARS" | "USD",
        amount:             Number(expense.amount),
        amountArs:          expense.amountArs ? Number(expense.amountArs) : null,
        dollarRateSnapshot: expense.dollarRateSnapshot ? Number(expense.dollarRateSnapshot) : null,
        isPaid:             expense.isPaid,
        createdAt:          expense.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[api/personal-expenses POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
