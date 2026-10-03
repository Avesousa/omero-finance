import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addPastPayments, fillStartedMonths, loanFields } from "@/lib/plan/loans";
import { readBody, v, withSession } from "@/lib/plan/server";

/**
 * POST /api/plan/loans — carga un préstamo o deuda.
 * Body: { direction, mode, name, counterpart, categoryId, currency, principal, installments,
 *         installmentAmount, interestRate, interestFrequency, interestAnnual, interestTaxPct, startPeriod, dueDay, endDate, note,
 *         schedule: [{ period, amount }], paidBefore, before }
 * `paidBefore`: cuotas que ya estaban pagadas; se cargan como pagadas en los meses anteriores a `before`.
 * Si alguno de sus meses ya está iniciado, genera la cuota en ese mes.
 */
export async function POST(req: NextRequest) {
  return withSession(req, async ({ householdId }) => {
    const body = await readBody(req);
    const { data, schedule } = await loanFields(householdId, body);
    const paidBefore = data.mode === "OPEN" ? 0 : v.optionalInt(body.paidBefore, "Cuotas ya pagadas", 0, 360) ?? 0;
    const before = body.before === undefined ? undefined : v.nearPeriod(body.before);
    const id = await prisma.$transaction(async (tx) => {
      const loan = await tx.planLoan.create({
        data: { householdId, ...data, schedule: { create: schedule } },
      });
      // Cuotas que ya venía pagando: se cargan como pagadas antes de generar las del mes.
      if (paidBefore > 0) await addPastPayments(tx, householdId, loan.id, { count: paidBefore, before });
      await fillStartedMonths(tx, householdId, loan.id);
      return loan.id;
    });
    return NextResponse.json({ id }, { status: 201 });
  });
}
