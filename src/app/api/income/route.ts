import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";

const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return unauthorized();
  }

  try {
    const body = await req.json();
    const { type, currency, amount, description, targetUserId, isPersonal } = body;

    if (!type || !amount) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    const { householdId, id: createdById } = session.user;
    const now   = new Date();
    const month = MONTH_NAMES[now.getMonth()];
    const year  = now.getFullYear();

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
        month,
        year,
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
