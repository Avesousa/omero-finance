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

  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const { householdId } = session.user;

  const where: Record<string, unknown> = { householdId };

  if (yearParam) {
    const year = parseInt(yearParam, 10);
    if (!isNaN(year)) {
      where.date = {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lt:  new Date(`${year + 1}-01-01T00:00:00.000Z`),
      };
    }
  }

  const savings = await prisma.saving.findMany({
    where,
    orderBy: { date: "desc" },
  });

  return NextResponse.json(
    savings.map((s) => ({
      id:                 s.id,
      date:               s.date.toISOString(),
      description:        s.description,
      type:               s.type,
      currency:           s.currency,
      amount:             Number(s.amount),
      amountArs:          s.amountArs != null ? Number(s.amountArs) : null,
      dollarRateSnapshot: s.dollarRateSnapshot != null ? Number(s.dollarRateSnapshot) : null,
      platform:           s.platform,
      createdById:        s.createdById,
      createdAt:          s.createdAt.toISOString(),
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

  try {
    const body = await req.json();
    const { date, description, type, currency, amount, platform } = body;

    if (!date || !description?.trim() || !type || !amount) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    const validTypes = ["AHORRO", "VIAJE", "INVERSION"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    const { householdId, id: createdById } = session.user;

    const saving = await prisma.saving.create({
      data: {
        householdId,
        createdById,
        date:        new Date(date),
        description: description.trim(),
        type,
        currency:    currency ?? "ARS",
        amount:      parsedAmount,
        platform:    platform?.trim() || null,
      },
    });

    return NextResponse.json(
      {
        id:          saving.id,
        date:        saving.date.toISOString(),
        description: saving.description,
        type:        saving.type,
        currency:    saving.currency,
        amount:      Number(saving.amount),
        amountArs:   saving.amountArs != null ? Number(saving.amountArs) : null,
        platform:    saving.platform,
        createdAt:   saving.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Error al crear el ahorro" }, { status: 500 });
  }
}
