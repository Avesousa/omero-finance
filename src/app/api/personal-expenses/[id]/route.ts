import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return unauthorized();
  }

  try {
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (body.concept   !== undefined) data.concept   = body.concept.trim();
    if (body.cardName  !== undefined) data.cardName  = body.cardName?.trim() || null;
    if (body.currency  !== undefined) data.currency  = body.currency;
    if (body.isPaid    !== undefined) data.isPaid    = body.isPaid;
    if (body.amount    !== undefined) {
      const amountNum = parseFloat(body.amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
      }
      data.amount = amountNum;

      // Recalculate ARS if currency is USD
      const currency = body.currency ?? undefined;
      if (currency === "USD") {
        const rate = await prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } });
        data.dollarRateSnapshot = rate ? Number(rate.usdArs) : null;
        data.amountArs = data.dollarRateSnapshot ? amountNum * (data.dollarRateSnapshot as number) : null;
      } else if (currency === "ARS") {
        data.dollarRateSnapshot = null;
        data.amountArs = null;
      }
    }

    // Verify this expense belongs to the same household
    const existing = await prisma.personalExpense.findUnique({ where: { id } });
    if (!existing || existing.householdId !== session.user.householdId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const expense = await prisma.personalExpense.update({ where: { id }, data });

    return NextResponse.json({
      id:                 expense.id,
      householdId:        expense.householdId,
      userId:             expense.userId,
      createdById:        expense.createdById,
      month:              expense.month,
      year:               expense.year,
      concept:            expense.concept,
      cardName:           expense.cardName ?? null,
      currency:           expense.currency as "ARS" | "USD",
      amount:             Number(expense.amount),
      amountArs:          expense.amountArs ? Number(expense.amountArs) : null,
      dollarRateSnapshot: expense.dollarRateSnapshot ? Number(expense.dollarRateSnapshot) : null,
      isPaid:             expense.isPaid,
      createdAt:          expense.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("[api/personal-expenses PATCH]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return unauthorized();
  }

  try {
    const { id } = await params;

    const existing = await prisma.personalExpense.findUnique({ where: { id } });
    if (!existing || existing.householdId !== session.user.householdId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    await prisma.personalExpense.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/personal-expenses DELETE]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
