import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";

const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return unauthorized();
  }

  try {
    const body = await req.json();
    const { cardName, totalAmountArs, usdAmount, dueDate, minimumPayment, month, year } = body;

    if (!cardName || !totalAmountArs || !dueDate) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const amount = parseFloat(totalAmountArs);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    const { householdId, id: createdById } = session.user;
    const now         = new Date();
    const targetMonth = month ?? MONTH_NAMES[now.getMonth()];
    const targetYear  = year  ?? now.getFullYear();

    const latestRate = await prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } });

    const record = await prisma.creditCardStatement.create({
      data: {
        householdId,
        createdById,
        month: targetMonth,
        year: targetYear,
        cardName,
        dueDate: new Date(dueDate),
        totalAmountArs: amount,
        amountToPay: amount,
        usdAmount: usdAmount ? parseFloat(usdAmount) : undefined,
        dollarRateSnapshot: latestRate ? Number(latestRate.usdArs) : undefined,
        minimumPayment: minimumPayment ? parseFloat(minimumPayment) : undefined,
      },
    });

    return NextResponse.json({ ok: true, id: record.id }, { status: 201 });
  } catch (err) {
    console.error("[api/tdc POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
