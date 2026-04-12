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

  const templates = await prisma.fixedExpenseTemplate.findMany({
    where: { householdId: session.user.householdId },
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

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return unauthorized();
  }

  const { concept, currency, amount } = await req.json();
  if (!concept?.trim() || !amount) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  const { householdId } = session.user;
  const maxOrder = await prisma.fixedExpenseTemplate.aggregate({
    where: { householdId },
    _max: { sortOrder: true },
  });

  const t = await prisma.fixedExpenseTemplate.create({
    data: {
      householdId,
      concept:   concept.trim(),
      currency:  currency ?? "ARS",
      amount:    parseFloat(amount),
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });

  return NextResponse.json(
    { id: t.id, concept: t.concept, currency: t.currency, amount: Number(t.amount), isActive: t.isActive, sortOrder: t.sortOrder },
    { status: 201 }
  );
}
