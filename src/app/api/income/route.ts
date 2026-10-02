import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";

const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

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
    const year = yearStr ? parseInt(yearStr, 10) : null;

    const { householdId } = session.user;

    const incomes = await prisma.income.findMany({
      where: {
        householdId,
        ...(month && { month }),
        ...(year && { year }),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      incomes.map((i) => ({
        id:                i.id,
        type:              i.type,
        currency:          i.currency,
        amount:            Number(i.amount),
        amountArs:         i.amountArs != null ? Number(i.amountArs) : null,
        dollarRateSnapshot: i.dollarRateSnapshot != null ? Number(i.dollarRateSnapshot) : null,
        description:       i.description,
        isPersonal:        i.isPersonal,
        month:             i.month,
        year:              i.year,
        createdById:       i.createdById,
        createdAt:         i.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    console.error("[api/income GET]", err);
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
    const { type, currency, amount, description, targetUserId, isPersonal, month, year } = body;

    if (!type || !amount) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    const { householdId, id: createdById } = session.user;
    const now   = new Date();
    const resolvedMonth = month ?? MONTH_NAMES[now.getMonth()];
    const resolvedYear  = year ?? now.getFullYear();

    // targetUserId allows assigning income to another household member
    const ownerId = targetUserId ?? createdById;

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
        householdId,
        createdById: ownerId,
        month:  resolvedMonth,
        year:   resolvedYear,
        type,
        currency: currency ?? "ARS",
        amount: parsed,
        amountArs: currency === "ARS" ? parsed : amountArs,
        dollarRateSnapshot,
        description: description || null,
        isPersonal: isPersonal === true,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[api/income POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
