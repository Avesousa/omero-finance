import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HOUSEHOLD_ID } from "../../../../prisma/constants";

// TODO: replace HOUSEHOLD_ID + userId with real auth session once wired

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    const { target, category, description, currency, expenseType, cardName, convertToArs, userId } = body;

    const now     = new Date();
    const month   = MONTH_NAMES[now.getMonth()];
    const year    = now.getFullYear();
    const createdById: string = userId ?? "cm_user_avelino";

    // Resolve amountArs and dollarRateSnapshot when USD
    let amountArs: number | undefined;
    let dollarRateSnapshot: number | undefined;
    if (currency === "USD" && convertToArs) {
      const rate = await prisma.exchangeRate.findFirst({
        orderBy: { date: "desc" },
      });
      dollarRateSnapshot = rate ? Number(rate.usdArs) : undefined;
      if (dollarRateSnapshot) amountArs = amount * dollarRateSnapshot;
    }

    let id: string;

    if (target === "personal") {
      const record = await prisma.personalExpense.create({
        data: {
          householdId: HOUSEHOLD_ID,
          userId:      createdById,
          createdById,
          month,
          year,
          concept:  description || "Personal",
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
          householdId: HOUSEHOLD_ID,
          createdById,
          month,
          year,
          description: description || "Mercado",
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
          householdId: HOUSEHOLD_ID,
          createdById,
          month,
          year,
          concept:     description || "Gasto fijo",
          subcategory: cardName || undefined,
          currency,
          amount,
          amountArs,
          dollarRateSnapshot,
        },
      });
      id = record.id;
    } else {
      // "general" household expense
      const record = await prisma.householdExpense.create({
        data: {
          householdId: HOUSEHOLD_ID,
          createdById,
          month,
          year,
          description: description || "Gasto",
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

const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];
