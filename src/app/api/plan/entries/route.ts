import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { monthlyAmount } from "@/lib/plan/core";
import {
  FREQUENCIES, KINDS, categoryIdOrNull, readBody, requireStartedMonth, v, withSession,
} from "@/lib/plan/server";

/**
 * POST /api/plan/entries — carga un ingreso o un gasto del mes.
 *
 * Variable: { period, kind, name, amount, currency, categoryId, targetCategoryId, date, note }
 * Fijo:     además `fixed: { frequency, weekday, dueDay }` y `amount` es el monto
 *           por vez (por día / semana / quincena / mes). Crea la regla y el
 *           movimiento del mes con el total (monto × veces en el mes).
 */
export async function POST(req: NextRequest) {
  return withSession(req, async ({ householdId }) => {
    const body = await readBody(req);
    const period = v.nearPeriod(body.period);
    const kind = v.oneOf(body.kind, KINDS, "Tipo");
    const name = v.text(body.name, "El nombre");
    const amount = v.amount(body.amount);
    const currency = v.currency(body.currency);
    const categoryId = await categoryIdOrNull(householdId, body.categoryId, kind);
    // Solo los ingresos pueden destinarse a una categoría de gasto.
    const targetCategoryId =
      kind === "INCOME" ? await categoryIdOrNull(householdId, body.targetCategoryId, "EXPENSE") : null;

    await requireStartedMonth(householdId, period);

    const fixed = body.fixed && typeof body.fixed === "object"
      ? (body.fixed as Record<string, unknown>)
      : null;

    if (fixed) {
      const frequency = v.oneOf(fixed.frequency ?? "MONTHLY", FREQUENCIES, "Frecuencia");
      const weekday = frequency === "WEEKLY" ? v.optionalInt(fixed.weekday, "Día de la semana", 0, 6) : null;
      const dueDay = v.optionalInt(fixed.dueDay, "Día del mes", 1, 31);

      const entry = await prisma.$transaction(async (tx) => {
        const rule = await tx.planRecurring.create({
          data: { householdId, kind, name, categoryId, targetCategoryId, currency, amount, frequency, weekday, dueDay },
        });
        return tx.planEntry.create({
          data: {
            householdId, period, kind, recurringId: rule.id, name, categoryId, targetCategoryId, currency,
            amount: monthlyAmount(amount, frequency, period, weekday),
          },
        });
      });
      return NextResponse.json({ id: entry.id }, { status: 201 });
    }

    const entry = await prisma.planEntry.create({
      data: {
        householdId, period, kind, name, amount, currency, categoryId, targetCategoryId,
        date: v.optionalDate(body.date),
        note: v.optionalText(body.note),
        isDone: true,
      },
    });
    return NextResponse.json({ id: entry.id }, { status: 201 });
  });
}
