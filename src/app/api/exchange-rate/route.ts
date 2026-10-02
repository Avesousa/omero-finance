import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";
import { SessionError } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const { householdId } = session.user;
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");

    if (dateParam) {
      // Get rate for a specific date (exact match by date field)
      const date = new Date(dateParam);
      date.setUTCHours(0, 0, 0, 0);
      const next = new Date(date);
      next.setUTCDate(next.getUTCDate() + 1);

      const rate = await prisma.exchangeRate.findFirst({
        where: {
          date: { gte: date, lt: next },
          OR: [{ householdId }, { householdId: null }],
        },
        orderBy: [{ householdId: "desc" }, { date: "desc" }],
      });

      if (!rate) {
        return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      }

      return NextResponse.json({
        id:          rate.id,
        householdId: rate.householdId,
        date:        rate.date.toISOString(),
        usdArs:      Number(rate.usdArs),
        source:      rate.source,
      });
    }

    // Return the 10 most recent rates for this household (or global)
    const rates = await prisma.exchangeRate.findMany({
      where: { OR: [{ householdId }, { householdId: null }] },
      orderBy: { date: "desc" },
      take: 10,
    });

    return NextResponse.json(
      rates.map((r) => ({
        id:          r.id,
        householdId: r.householdId,
        date:        r.date.toISOString(),
        usdArs:      Number(r.usdArs),
        source:      r.source,
      }))
    );
  } catch (err) {
    if (err instanceof SessionError) return unauthorized();
    return NextResponse.json({ error: "Error al obtener el tipo de cambio" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const { householdId } = session.user;
    const body = await req.json();
    const { usdArs, date: dateParam } = body;

    if (!usdArs || isNaN(Number(usdArs)) || Number(usdArs) <= 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    const targetDate = dateParam ? new Date(dateParam) : new Date();
    targetDate.setUTCHours(0, 0, 0, 0);

    const rate = await prisma.exchangeRate.upsert({
      where: { date: targetDate },
      create: {
        householdId,
        date:   targetDate,
        usdArs: Number(usdArs),
        source: "MANUAL",
      },
      update: {
        householdId,
        usdArs: Number(usdArs),
        source: "MANUAL",
      },
    });

    return NextResponse.json(
      {
        id:          rate.id,
        householdId: rate.householdId,
        date:        rate.date.toISOString(),
        usdArs:      Number(rate.usdArs),
        source:      rate.source,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof SessionError) return unauthorized();
    return NextResponse.json({ error: "Error al guardar el tipo de cambio" }, { status: 500 });
  }
}
