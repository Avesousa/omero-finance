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

    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    const { target, category, description, currency, expenseType, cardName, convertToArs } = body;

    const { householdId, id: createdById } = session.user;
    const now   = new Date();
    const month = MONTH_NAMES[now.getMonth()];
    const year  = now.getFullYear();

    let amountArs: number | undefined;
    let dollarRateSnapshot: number | undefined;
    if (currency === "USD" && convertToArs) {
      const rate = await prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } });
      dollarRateSnapshot = rate ? Number(rate.usdArs) : undefined;
      if (dollarRateSnapshot) amountArs = amount * dollarRateSnapshot;
    }

    let id: string;

    if (target === "personal") {
      const record = await prisma.personalExpense.create({
        data: {
          householdId,
          userId: createdById,
          createdById,
          month,
          year,
          concept: description || "Personal",
          cardName: cardName || undefined,
          currency,
          amount,
          amountArs,
          dollarRateSnapshot,
        },
      });
      id = record.id;
    } else if (category === "mercado") {
      const record = await prisma.groceryExpense.create({
        data: {
          householdId,
          createdById,
          month,
          year,
          description: description || "Mercado",
          cardName: cardName || undefined,
          currency,
          amount,
          amountArs,
          dollarRateSnapshot,
        },
      });
      id = record.id;
    } else if (category === "fijo") {
      const record = await prisma.fixedExpense.create({
        data: {
          householdId,
          createdById,
          month,
          year,
          concept: description || "Gasto fijo",
          subcategory: cardName || undefined,
          currency,
          amount,
          amountArs,
          dollarRateSnapshot,
        },
      });
      id = record.id;
    } else {
      const record = await prisma.householdExpense.create({
        data: {
          householdId,
          createdById,
          month,
          year,
          description: description || "Gasto",
          cardName: cardName || undefined,
          expenseType: expenseType ?? "UNNECESSARY",
          currency,
          amount,
          amountArs,
          dollarRateSnapshot,
        },
      });
      id = record.id;
    }

    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    console.error("[api/expenses]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
