import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readBody, v, withSession } from "@/lib/plan/server";

const TYPES = ["ASSET", "DEBT"] as const;

/**
 * POST /api/plan/balance — agrega algo que tenés (ASSET) o que debés (DEBT).
 * Body: { type, name, currency, amount, period }
 */
export async function POST(req: NextRequest) {
  return withSession(req, async ({ householdId }) => {
    const body = await readBody(req);
    const type = v.oneOf(body.type, TYPES, "Tipo");
    const name = v.text(body.name, "El nombre", 60);
    const currency = v.currency(body.currency);
    const period = v.nearPeriod(body.period);
    const amount = v.amount(body.amount, "Saldo", { allowZero: true });

    const item = await prisma.planBalanceItem.create({
      data: { householdId, type, name, currency, values: { create: { period, amount } } },
    });
    return NextResponse.json({ id: item.id }, { status: 201 });
  });
}
