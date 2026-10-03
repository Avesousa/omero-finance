import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { occurrencesInPeriod, round2, type Frequency } from "@/lib/plan/core";
import { ApiError, readBody, v, withSession } from "@/lib/plan/server";

/**
 * POST /api/plan/month — inicia un mes.
 * Trae los fijos elegidos (con el monto que se confirme) y el presupuesto.
 * Body: { period, usdRate, entries: [{ recurringId, amount }], budgets: [{ categoryId, amount }], updateRules }
 */
export async function POST(req: NextRequest) {
  return withSession(req, async ({ householdId }) => {
    const body = await readBody(req);
    const period = v.nearPeriod(body.period);
    const usdRate = v.amount(body.usdRate ?? 0, "Tipo de cambio", { allowZero: true });
    const updateRules = body.updateRules === true;

    const rawEntries = Array.isArray(body.entries) ? body.entries : [];
    const rawBudgets = Array.isArray(body.budgets) ? body.budgets : [];

    const recurrings = await prisma.planRecurring.findMany({ where: { householdId, isActive: true } });
    const recurringById = new Map(recurrings.map((r) => [r.id, r]));
    const categories = await prisma.planCategory.findMany({ where: { householdId, kind: "EXPENSE" } });
    const categoryIds = new Set(categories.map((c) => c.id));

    const entries = rawEntries.map((raw: Record<string, unknown>) => {
      const rule = recurringById.get(String(raw?.recurringId));
      if (!rule) throw new ApiError("Hay un fijo que ya no existe. Recargá la página.");
      return { rule, amount: v.amount(raw.amount, `Monto de ${rule.name}`, { allowZero: true }) };
    });
    const budgets = rawBudgets
      .map((raw: Record<string, unknown>) => {
        const categoryId = String(raw?.categoryId);
        if (!categoryIds.has(categoryId)) throw new ApiError("Categoría de presupuesto inválida");
        return { categoryId, amount: v.amount(raw.amount, "Presupuesto", { allowZero: true }) };
      })
      .filter((b: { amount: number }) => b.amount > 0);

    await prisma.$transaction(async (tx) => {
      await tx.planMonth.upsert({
        where: { householdId_period: { householdId, period } },
        create: { householdId, period, usdRate },
        update: { usdRate },
      });

      if (entries.length > 0) {
        await tx.planEntry.createMany({
          data: entries.map(({ rule, amount }: { rule: (typeof recurrings)[number]; amount: number }) => ({
            householdId,
            period,
            kind: rule.kind,
            recurringId: rule.id,
            name: rule.name,
            categoryId: rule.categoryId,
            targetCategoryId: rule.targetCategoryId,
            currency: rule.currency,
            amount,
          })),
          skipDuplicates: true,
        });

        if (updateRules) {
          for (const { rule, amount } of entries as { rule: (typeof recurrings)[number]; amount: number }[]) {
            const occ = occurrencesInPeriod(rule.frequency as Frequency, period, rule.weekday);
            const unit = round2(amount / occ);
            if (unit > 0 && unit !== Number(rule.amount)) {
              await tx.planRecurring.update({ where: { id: rule.id }, data: { amount: unit } });
            }
          }
        }
      }

      for (const b of budgets as { categoryId: string; amount: number }[]) {
        await tx.planBudget.upsert({
          where: { householdId_period_categoryId: { householdId, period, categoryId: b.categoryId } },
          create: { householdId, period, categoryId: b.categoryId, amount: b.amount },
          update: { amount: b.amount },
        });
      }
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  });
}

/** PATCH /api/plan/month — cambia el tipo de cambio del mes. Body: { period, usdRate } */
export async function PATCH(req: NextRequest) {
  return withSession(req, async ({ householdId }) => {
    const body = await readBody(req);
    const period = v.period(body.period);
    const usdRate = v.amount(body.usdRate, "Tipo de cambio");

    const month = await prisma.planMonth.findUnique({
      where: { householdId_period: { householdId, period } },
    });
    if (!month) throw new ApiError("Primero iniciá el mes", 409);

    await prisma.planMonth.update({ where: { id: month.id }, data: { usdRate } });
    return NextResponse.json({ ok: true });
  });
}
