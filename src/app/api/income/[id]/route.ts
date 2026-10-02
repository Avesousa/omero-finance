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
    const body   = await req.json();
    const { householdId } = session.user;

    const existing = await prisma.income.findUnique({ where: { id } });
    if (!existing || existing.householdId !== householdId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const { type, currency, amount, description, isPersonal } = body;
    const parsed = amount !== undefined ? parseFloat(amount) : undefined;
    if (parsed !== undefined && (isNaN(parsed) || parsed <= 0)) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    let amountArs: number | null | undefined;
    let dollarRateSnapshot: number | null | undefined;

    if (currency === "USD" && parsed !== undefined) {
      const latestRate = await prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } });
      if (latestRate) {
        dollarRateSnapshot = Number(latestRate.usdArs);
        amountArs = parsed * dollarRateSnapshot;
      }
    } else if (currency === "ARS" && parsed !== undefined) {
      amountArs = parsed;
      dollarRateSnapshot = null;
    }

    const updated = await prisma.income.update({
      where: { id },
      data: {
        ...(type        !== undefined && { type }),
        ...(currency    !== undefined && { currency }),
        ...(parsed      !== undefined && { amount: parsed }),
        ...(amountArs   !== undefined && { amountArs }),
        ...(dollarRateSnapshot !== undefined && { dollarRateSnapshot }),
        ...(description !== undefined && { description: description || null }),
        ...(isPersonal  !== undefined && { isPersonal }),
      },
    });

    return NextResponse.json({
      id:          updated.id,
      type:        updated.type,
      currency:    updated.currency,
      amount:      Number(updated.amount),
      amountArs:   updated.amountArs != null ? Number(updated.amountArs) : null,
      description: updated.description,
      isPersonal:  updated.isPersonal,
    });
  } catch (err) {
    console.error("[api/income/[id] PATCH]", err);
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
    const { householdId } = session.user;

    const existing = await prisma.income.findUnique({ where: { id } });
    if (!existing || existing.householdId !== householdId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    await prisma.income.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/income/[id] DELETE]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
