import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HOUSEHOLD_ID } from "../../../../prisma/constants";

const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, type, currency, amount, description } = body;

    if (!userId || !type || !amount) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    const now   = new Date();
    const month = MONTH_NAMES[now.getMonth()];
    const year  = now.getFullYear();

    let amountArs: number | undefined;
    let dollarRateSnapshot: number | undefined;

    if (currency === "USD") {
      const latestRate = await prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } });
      if (latestRate) {
        dollarRateSnapshot = Number(latestRate.usdArs);
        amountArs = parsed * dollarRateSnapshot;
      }
    }

    await prisma.income.create({
      data: {
        householdId:        HOUSEHOLD_ID,
        createdById:        userId,
        month,
        year,
        type,
        currency:           currency ?? "ARS",
        amount:             parsed,
        amountArs:          currency === "ARS" ? parsed : amountArs,
        dollarRateSnapshot: dollarRateSnapshot,
        description:        description || null,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[api/income POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
