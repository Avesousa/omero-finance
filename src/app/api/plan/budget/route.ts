import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, readBody, v, withSession } from "@/lib/plan/server";

/**
 * PUT /api/plan/budget — guarda el presupuesto del mes.
 * Body: { period, items: [{ categoryId, amount }] } · monto 0 quita la línea.
 */
export async function PUT(req: NextRequest) {
  return withSession(req, async ({ householdId }) => {
    const body = await readBody(req);
    const period = v.nearPeriod(body.period);
    if (!Array.isArray(body.items)) throw new ApiError("Faltan las líneas del presupuesto");

    const categories = await prisma.planCategory.findMany({ where: { householdId, kind: "EXPENSE" } });
    const valid = new Set(categories.map((c) => c.id));

    const items = (body.items as Record<string, unknown>[]).map((raw) => {
      const categoryId = String(raw?.categoryId);
      if (!valid.has(categoryId)) throw new ApiError("Categoría inválida");
      return { categoryId, amount: v.amount(raw.amount, "Presupuesto", { allowZero: true }) };
    });

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (item.amount === 0) {
          await tx.planBudget.deleteMany({ where: { householdId, period, categoryId: item.categoryId } });
        } else {
          await tx.planBudget.upsert({
            where: { householdId_period_categoryId: { householdId, period, categoryId: item.categoryId } },
            create: { householdId, period, categoryId: item.categoryId, amount: item.amount },
            update: { amount: item.amount },
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  });
}
