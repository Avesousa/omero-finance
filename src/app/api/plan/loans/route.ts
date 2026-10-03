import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fillStartedMonths, loanFields } from "@/lib/plan/loans";
import { readBody, withSession } from "@/lib/plan/server";

/**
 * POST /api/plan/loans — carga un préstamo o deuda.
 * Body: { direction, mode, name, counterpart, categoryId, currency, principal, installments,
 *         installmentAmount, interestRate, interestFrequency, startPeriod, dueDay, endDate, note,
 *         schedule: [{ period, amount }] }
 * Si alguno de sus meses ya está iniciado, genera la cuota en ese mes.
 */
export async function POST(req: NextRequest) {
  return withSession(req, async ({ householdId }) => {
    const { data, schedule } = await loanFields(householdId, await readBody(req));
    const id = await prisma.$transaction(async (tx) => {
      const loan = await tx.planLoan.create({
        data: { householdId, ...data, schedule: { create: schedule } },
      });
      await fillStartedMonths(tx, householdId, loan.id);
      return loan.id;
    });
    return NextResponse.json({ id }, { status: 201 });
  });
}
