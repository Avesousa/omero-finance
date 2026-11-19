import { prisma } from "@/lib/prisma";
import { ApiError } from "./api-error";
import { requireAccount } from "./accounts";
import { statementToPay } from "./core";
import type { ApiContext } from "./server";

export async function payStatement(ctx: ApiContext, id: string, body: Record<string, unknown>, undo = false) {
  return prisma.$transaction(async (tx) => {
    const st = await tx.planCardStatement.findUnique({ where: { id } });
    await ctx.assert(st, "update");
    if (!st) throw new ApiError("Resumen no encontrado", 404);
    if (undo) {
      // Solo pueden revertir los que conservan acceso a la cuenta afectada.
      const payments = await tx.planCardPayment.findMany({ where: { statementId: id }, include: { account: true } });
      for (const p of payments) await ctx.assert(p.account, "update");
      await tx.planCardPayment.deleteMany({ where: { statementId: id } });
      await tx.planCardStatement.update({ where: { id }, data: { isPaid: false, paidAt: null } });
      return { ok: true };
    }
    if (st.isPaid) throw new ApiError("El resumen ya está pagado", 409);
    const month = await tx.planMonth.findUnique({ where: { householdId_period: { householdId: st.householdId, period: st.period } } });
    const usdRate = Number(month?.usdRate ?? 0);
    // Fecha del pago (YYYY-MM-DD, por defecto hoy) y forma de pago elegidas al pagar; sin `mode`, vale lo cargado con el resumen.
    let paidAt = new Date();
    if (body.paidAt != null && body.paidAt !== "") {
      if (typeof body.paidAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.paidAt) || Number.isNaN(Date.parse(`${body.paidAt}T12:00:00.000Z`))) throw new ApiError("Fecha de pago inválida");
      paidAt = new Date(`${body.paidAt}T12:00:00.000Z`);
    }
    let payMode = st.payMode;
    let customAmount = st.customAmount == null ? null : Number(st.customAmount);
    if (body.mode != null) {
      if (body.mode !== "TOTAL" && body.mode !== "MINIMUM" && body.mode !== "CUSTOM") throw new ApiError("Forma de pago inválida");
      payMode = body.mode;
      if (payMode === "MINIMUM" && st.minimumArs == null) throw new ApiError("Este resumen no tiene pago mínimo cargado");
      if (payMode === "CUSTOM") {
        const n = Number(body.amount);
        if (!Number.isFinite(n) || n <= 0) throw new ApiError("Ingresá un monto mayor a cero");
        customAmount = Math.round(n * 100) / 100;
      }
    }
    if (body.usdAccountId && payMode !== "TOTAL") throw new ApiError("El pago mínimo u otro monto se registra en pesos");
    const separateUsd = body.usdAccountId != null && Number(st.usdAmount ?? 0) > 0 && payMode === "TOTAL";
    const amount = separateUsd ? Number(st.totalArs) : statementToPay({ totalArs: Number(st.totalArs), minimumArs: st.minimumArs == null ? null : Number(st.minimumArs), usdAmount: st.usdAmount == null ? null : Number(st.usdAmount), payMode, customAmount }, usdRate);
    if (!separateUsd && Number(st.usdAmount ?? 0) > 0 && usdRate <= 0 && (payMode === "TOTAL" || (payMode === "MINIMUM" && st.minimumArs == null) || (payMode === "CUSTOM" && customAmount == null))) throw new ApiError("Cargá el tipo de cambio o elegí una cuenta USD");
    const accountId = amount > 0 ? await requireAccount(body.accountId, st.householdId, "ARS", true, tx) : null;
    if (amount > 0 && !accountId) throw new ApiError("Elegí una cuenta en pesos");
    if (amount > 0) await tx.planCardPayment.create({ data: { statementId: id, householdId: st.householdId, accountId: accountId!, currency: "ARS", amount, paidByUserId: ctx.userId, paidAt } });
    if (separateUsd) {
      const usdId = await requireAccount(body.usdAccountId, st.householdId, "USD", true, tx);
      if (!usdId) throw new ApiError("Elegí una cuenta en dólares");
      await tx.planCardPayment.create({ data: { statementId: id, householdId: st.householdId, accountId: usdId, currency: "USD", amount: st.usdAmount!, paidByUserId: ctx.userId, paidAt } });
    }
    if (amount <= 0 && !separateUsd) throw new ApiError("El resumen no tiene un monto a pagar");
    await tx.planCardStatement.update({ where: { id }, data: { isPaid: true, paidAt } });
    return { ok: true };
  }, { isolationLevel: "Serializable" });
}
