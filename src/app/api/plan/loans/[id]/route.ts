import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loanFields, refreshLoanStatus } from "@/lib/plan/loans";
import { ApiError, loadLoans, readBody, withSession } from "@/lib/plan/server";

type Params = { params: Promise<{ id: string }> };

async function findLoan(householdId: string, id: string) {
  const [loan] = await loadLoans(householdId, { id });
  if (!loan) throw new ApiError("No encontrado", 404);
  return loan;
}

/**
 * PATCH /api/plan/loans/[id] — mismos campos que el alta, salvo tipo, modalidad y moneda.
 * Las cuotas ya generadas que no están pagadas toman el nombre y la categoría nuevos.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withSession(req, async ({ householdId }) => {
    const { id } = await params;
    const loan = await findLoan(householdId, id);
    const { data, schedule } = await loanFields(householdId, await readBody(req), loan);

    await prisma.$transaction(async (tx) => {
      await tx.planLoan.update({ where: { id }, data });
      if (loan.mode === "SCHEDULE") {
        await tx.planLoanScheduleItem.deleteMany({ where: { loanId: id } });
        await tx.planLoanScheduleItem.createMany({ data: schedule.map((s) => ({ loanId: id, ...s })) });
      }
      await tx.planEntry.updateMany({
        where: { loanId: id, isDone: false },
        data: { name: data.name, categoryId: data.categoryId },
      });
      await refreshLoanStatus(tx, householdId, id);
    });
    return NextResponse.json({ ok: true });
  });
}

/**
 * DELETE /api/plan/loans/[id]
 * Si tiene cuotas generadas, no se borra salvo que venga `?confirm=1`;
 * en ese caso se borran junto con él (también las ya pagadas).
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  return withSession(req, async ({ householdId }) => {
    const { id } = await params;
    const loan = await findLoan(householdId, id);
    const confirmed = new URL(req.url).searchParams.get("confirm") === "1";
    const payments = loan.payments.length;
    if (payments > 0 && !confirmed) {
      return NextResponse.json({ error: "El préstamo tiene cuotas cargadas", payments }, { status: 409 });
    }
    // Las cuotas (PlanEntry) y el cronograma se borran en cascada.
    await prisma.planLoan.delete({ where: { id } });
    return NextResponse.json({ ok: true, payments });
  });
}
