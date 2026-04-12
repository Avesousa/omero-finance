import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return unauthorized();
  }

  try {
    const { month, year } = await req.json();

    if (!month || !year) {
      return NextResponse.json({ error: "Mes y año son requeridos" }, { status: 400 });
    }

    const { householdId, id: createdById } = session.user;

    // Check if any FixedExpense already exists for this household + month + year
    const existing = await prisma.fixedExpense.count({
      where: { householdId, month, year },
    });

    if (existing > 0) {
      return NextResponse.json({ generated: 0, message: "Ya existen gastos para este mes" });
    }

    // Fetch all active templates
    const templates = await prisma.fixedExpenseTemplate.findMany({
      where: { householdId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    if (templates.length === 0) {
      return NextResponse.json({ generated: 0, message: "No hay plantillas activas" });
    }

    // Create one FixedExpense per template
    await prisma.fixedExpense.createMany({
      data: templates.map((t) => ({
        householdId,
        createdById,
        concept: t.concept,
        currency: t.currency,
        amount: t.amount,
        isPaid: false,
        month,
        year,
      })),
    });

    return NextResponse.json({ generated: templates.length });
  } catch (err) {
    console.error("[api/fixed-expenses/generate]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
