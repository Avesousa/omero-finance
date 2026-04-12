import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HOUSEHOLD_ID, AVELINO_ID } from "../../../../prisma/constants";

const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

/** GET /api/rent?month=abril&year=2026 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const now   = new Date();
  const month = searchParams.get("month") ?? MONTH_NAMES[now.getMonth()];
  const year  = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10);

  try {
    const payments = await prisma.rentPayment.findMany({
      where: { householdId: HOUSEHOLD_ID, month, year },
      orderBy: [{ type: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(
      payments.map((p) => ({
        id:          p.id,
        type:        p.type,
        apartment:   p.apartment,
        currency:    p.currency,
        amount:      Number(p.amount),
        amountArs:   p.amountArs ? Number(p.amountArs) : null,
        description: p.description,
        cbuAlias:    p.cbuAlias,
        month:       p.month,
        year:        p.year,
        createdAt:   p.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    console.error("[api/rent GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/** POST /api/rent */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, apartment, currency, amount, description, cbuAlias, month, year } = body;

    if (!type || !apartment || !amount) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const validTypes = ["ALQUILER", "EXPENSAS", "TRABAJOS"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    const now         = new Date();
    const targetMonth = month ?? MONTH_NAMES[now.getMonth()];
    const targetYear  = typeof year === "number" ? year : now.getFullYear();

    const payment = await prisma.rentPayment.create({
      data: {
        householdId: HOUSEHOLD_ID,
        createdById: AVELINO_ID,
        month:       targetMonth,
        year:        targetYear,
        type,
        apartment,
        currency:    currency ?? "ARS",
        amount:      parsedAmount,
        description: description ?? null,
        cbuAlias:    cbuAlias ?? null,
      },
    });

    return NextResponse.json({ ok: true, id: payment.id }, { status: 201 });
  } catch (err) {
    console.error("[api/rent POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
