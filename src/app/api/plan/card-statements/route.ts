import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PAY_MODES, readBody, requireCard, v, withSession } from "@/lib/plan/server";

/**
 * POST /api/plan/card-statements — carga (o reemplaza) el resumen de una tarjeta en un mes.
 * Body: { cardId, period, totalArs, minimumArs, usdAmount, dueDate, payMode, customAmount }
 */
export async function POST(req: NextRequest) {
  return withSession(req, async ({ householdId }) => {
    const body = await readBody(req);
    const cardId = await requireCard(householdId, body.cardId);
    const period = v.nearPeriod(body.period);

    const data = {
      totalArs: v.amount(body.totalArs, "Monto total", { allowZero: true }),
      minimumArs: v.optionalAmount(body.minimumArs, "Pago mínimo"),
      usdAmount: v.optionalAmount(body.usdAmount, "Monto en dólares"),
      dueDate: v.optionalDate(body.dueDate),
      payMode: v.oneOf(body.payMode ?? "TOTAL", PAY_MODES, "Forma de pago"),
      customAmount: v.optionalAmount(body.customAmount, "Monto a pagar"),
    };

    const saved = await prisma.planCardStatement.upsert({
      where: { cardId_period: { cardId, period } },
      create: { householdId, cardId, period, ...data },
      update: data,
    });
    return NextResponse.json({ id: saved.id }, { status: 201 });
  });
}
