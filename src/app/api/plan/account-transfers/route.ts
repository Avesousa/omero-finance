import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TRANSFER_KINDS, assertAccount, accountBalance } from "@/lib/plan/accounts";
import { ApiError, readBody, v, withSession } from "@/lib/plan/server";
import { todayIso } from "@/lib/plan/core";
export async function GET(req: NextRequest) {
 return withSession(req, "read", async (ctx) => NextResponse.json({ transfers: await prisma.planAccountTransfer.findMany({ where: { householdId: ctx.householdId, createdByUserId: ctx.userId }, orderBy: { date: "desc" } }) }));
}
export async function POST(req: NextRequest) {
 return withSession(req, "create", async (ctx) => {
  const b = await readBody(req);
  const from = await assertAccount(ctx, v.text(b.fromAccountId, "Cuenta origen"), true);
  if (from.isArchived || from.householdId !== ctx.householdId) throw new ApiError("Elegí una cuenta activa de esta finanza");
  const kind = v.oneOf(b.kind ?? "TRANSFER", TRANSFER_KINDS, "Operación");
  const amountFrom = v.amount(b.amountFrom);
  const date = v.optionalDate(b.date ?? todayIso());
  if (!date) throw new ApiError("Elegí una fecha");
  const result = await prisma.$transaction(async (tx) => {
    const freshFrom = await tx.planAccount.findUniqueOrThrow({ where: { id: from.id } });
    if (freshFrom.householdId !== ctx.householdId || freshFrom.isArchived) throw new ApiError("La cuenta cambió; volvé a cargar", 409);
    let toId = typeof b.toAccountId === "string" ? b.toAccountId : null;
    if (kind === "CASH_WITHDRAWAL" && !toId) {
      const cash = await tx.planAccount.findFirst({ where: { householdId: from.householdId, ownerUserId: ctx.userId, type: "CASH", currency: from.currency, isArchived: false } });
      toId = cash?.id ?? (await tx.planAccount.create({ data: { householdId: from.householdId, ownerUserId: ctx.userId, name: "Efectivo", type: "CASH", currency: from.currency } })).id;
    }
    if (!toId || toId === from.id) throw new ApiError("Elegí otra cuenta destino");
    const to = await tx.planAccount.findUnique({ where: { id: toId } });
    if (!to || to.ownerUserId !== ctx.userId || to.householdId !== from.householdId || to.isArchived) throw new ApiError("La cuenta destino debe ser tuya y de esta finanza");
    const amountTo = kind === "BUY_USD" ? v.amount(b.amountTo) : amountFrom;
    if (kind !== "BUY_USD" && to.currency !== from.currency) throw new ApiError("Las cuentas deben tener la misma moneda");
    if (kind === "BUY_USD" && to.currency === from.currency) throw new ApiError("Elegí una cuenta en la otra moneda");
    if (kind === "CASH_WITHDRAWAL" && to.type !== "CASH") throw new ApiError("El destino debe ser una cuenta de efectivo");
    const rate = kind === "BUY_USD" ? (from.currency === "ARS" ? amountFrom / amountTo : amountTo / amountFrom) : null;
    if (rate != null && (!Number.isFinite(rate) || rate < 0.0001 || rate >= 1e10)) throw new ApiError("Tipo de cambio fuera de rango");
    return tx.planAccountTransfer.create({ data: { householdId: from.householdId, createdByUserId: ctx.userId, kind, fromAccountId: from.id, toAccountId: to.id, amountFrom, amountTo, rate, date, note: v.optionalText(b.note) } });
  }, { isolationLevel: "Serializable" });
  return NextResponse.json({ id: result.id, warning: await accountBalance(from.id) < 0 ? "La cuenta queda en negativo" : null }, { status: 201 });
 });
}
