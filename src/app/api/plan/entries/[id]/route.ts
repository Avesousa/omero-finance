import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { occurrencesInPeriod, round2, type Frequency } from "@/lib/plan/core";
import {
  ApiError, FREQUENCIES, categoryIdOrNull, readBody, v, withSession,
} from "@/lib/plan/server";

type Params = { params: Promise<{ id: string }> };

async function findEntry(householdId: string, id: string) {
  const entry = await prisma.planEntry.findFirst({ where: { id, householdId } });
  if (!entry) throw new ApiError("No encontrado", 404);
  return entry;
}

/**
 * PATCH /api/plan/entries/[id]
 * Campos opcionales: name, amount, currency, categoryId, targetCategoryId, date, note, isDone.
 * Para fijos: `applyToRule: true` guarda el cambio también en la regla
 * (próximos meses) y permite cambiar `frequency`, `weekday` y `dueDay`.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withSession(req, async ({ householdId }) => {
    const { id } = await params;
    const body = await readBody(req);
    const entry = await findEntry(householdId, id);

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = v.text(body.name, "El nombre");
    if (body.amount !== undefined) data.amount = v.amount(body.amount);
    if (body.currency !== undefined) data.currency = v.currency(body.currency);
    if (body.categoryId !== undefined) {
      data.categoryId = await categoryIdOrNull(householdId, body.categoryId, entry.kind);
    }
    if (body.targetCategoryId !== undefined && entry.kind === "INCOME") {
      data.targetCategoryId = await categoryIdOrNull(householdId, body.targetCategoryId, "EXPENSE");
    }
    if (body.date !== undefined) data.date = v.optionalDate(body.date);
    if (body.note !== undefined) data.note = v.optionalText(body.note);
    if (body.isDone !== undefined) data.isDone = body.isDone === true;

    await prisma.$transaction(async (tx) => {
      await tx.planEntry.update({ where: { id }, data });

      if (body.applyToRule === true && entry.recurringId) {
        const rule = await tx.planRecurring.findUnique({ where: { id: entry.recurringId } });
        if (rule) {
          const frequency = body.frequency !== undefined
            ? v.oneOf(body.frequency, FREQUENCIES, "Frecuencia")
            : (rule.frequency as Frequency);
          const weekday = frequency !== "WEEKLY"
            ? null
            : body.weekday !== undefined
              ? v.optionalInt(body.weekday, "Día de la semana", 0, 6)
              : rule.weekday;
          const monthTotal = (data.amount as number | undefined) ?? Number(entry.amount);
          const occ = occurrencesInPeriod(frequency, entry.period, weekday);
          await tx.planRecurring.update({
            where: { id: rule.id },
            data: {
              name: (data.name as string | undefined) ?? rule.name,
              currency: (data.currency as "ARS" | "USD" | undefined) ?? rule.currency,
              categoryId: data.categoryId !== undefined ? (data.categoryId as string | null) : rule.categoryId,
              targetCategoryId:
                data.targetCategoryId !== undefined ? (data.targetCategoryId as string | null) : rule.targetCategoryId,
              frequency,
              weekday,
              dueDay: body.dueDay !== undefined ? v.optionalInt(body.dueDay, "Día del mes", 1, 31) : rule.dueDay,
              amount: round2(monthTotal / occ),
            },
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  });
}

/**
 * DELETE /api/plan/entries/[id]
 * `?scope=rule` además desactiva la regla: el fijo no vuelve en los próximos meses.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  return withSession(req, async ({ householdId }) => {
    const { id } = await params;
    const entry = await findEntry(householdId, id);
    const scope = new URL(req.url).searchParams.get("scope");

    await prisma.$transaction(async (tx) => {
      await tx.planEntry.delete({ where: { id } });
      if (scope === "rule" && entry.recurringId) {
        await tx.planRecurring.update({ where: { id: entry.recurringId }, data: { isActive: false } });
      }
    });
    return NextResponse.json({ ok: true });
  });
}
