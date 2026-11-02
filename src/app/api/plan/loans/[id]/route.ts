import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loanFields, refreshLoanStatus, rethreadInterest } from "@/lib/plan/loans";
import { ApiError, loadLoans, readBody, withSession, type ApiContext } from "@/lib/plan/server";

type Params = { params: Promise<{ id: string }> };

/** Autoriza contra la finanza DEL PRÉSTAMO y devuelve el préstamo cargado con sus cuotas. */
async function findLoan(ctx: ApiContext, id: string, action: "update" | "delete") {
  const row = await prisma.planLoan.findUnique({ where: { id }, select: { id: true, householdId: true } });
  await ctx.assert(row, action);
  const [loan] = await loadLoans(row!.householdId, { id });
  if (!loan) throw new ApiError("No encontrado", 404);
  return { loan, householdId: row!.householdId };
}

/**
 * PATCH /api/plan/loans/[id] — mismos campos que el alta, salvo tipo, modalidad y moneda.
 * Las cuotas ya generadas que no están pagadas toman el nombre y la categoría nuevos,
 * y su interés se recalcula con la tasa nueva.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withSession(req, "update", async (ctx) => {
    const { id } = await params;
    const { loan, householdId } = await findLoan(ctx, id, "update");
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
      const [updated] = await loadLoans(householdId, { id }, tx);
      if (updated) await rethreadInterest(tx, updated);
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
  return withSession(req, "delete", async (ctx) => {
    const { id } = await params;
    const { loan } = await findLoan(ctx, id, "delete");
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
