import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HOUSEHOLD_ID } from "../../../../prisma/constants";

export async function GET() {
  const templates = await prisma.fixedExpenseTemplate.findMany({
    where: { householdId: HOUSEHOLD_ID },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(
    templates.map((t) => ({
      id:        t.id,
      concept:   t.concept,
      currency:  t.currency,
      amount:    Number(t.amount),
      isActive:  t.isActive,
      sortOrder: t.sortOrder,
    }))
  );
}

export async function POST(req: Request) {
  const { concept, currency, amount } = await req.json();
  if (!concept?.trim() || !amount) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }
  const maxOrder = await prisma.fixedExpenseTemplate.aggregate({
    where: { householdId: HOUSEHOLD_ID },
    _max: { sortOrder: true },
  });
  const t = await prisma.fixedExpenseTemplate.create({
    data: {
      householdId: HOUSEHOLD_ID,
      concept:     concept.trim(),
      currency:    currency ?? "ARS",
      amount:      parseFloat(amount),
      sortOrder:   (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json({ id: t.id, concept: t.concept, currency: t.currency, amount: Number(t.amount), isActive: t.isActive, sortOrder: t.sortOrder }, { status: 201 });
}
