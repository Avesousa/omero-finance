import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { ApiError } from "./api-error";
import { assertAccount, assertResourceOwner } from "./accounts";
import { mapCategoriesByName } from "./finances";
import { ensurePlanDefaults, v, type ApiContext } from "./server";

type Tx = Prisma.TransactionClient;
export async function ensureMoveMonths(tx: Tx, fromId: string, toId: string, periods: string[]) {
  const months = await tx.planMonth.findMany({ where: { householdId: fromId, period: { in: periods } } });
  for (const m of months) await tx.planMonth.upsert({ where: { householdId_period: { householdId: toId, period: m.period } }, create: { householdId: toId, period: m.period, usdRate: m.usdRate }, update: {} });
}
export async function moveResource(ctx: ApiContext, kind: "account" | "card", id: string, destination: unknown) {
  const resource = kind === "account" ? await assertAccount(ctx, id, true) : await prisma.card.findUnique({ where: { id } });
  await assertResourceOwner(ctx, resource);
  if (!resource) throw new ApiError("No encontrado", 404);
  // La propiedad permite ver el recurso, pero no reclasificar datos privados de una finanza sin rol.
  await ctx.assert({ householdId: resource.householdId }, "update");
  const toId = v.text(destination, "Finanza destino");
  if (resource.householdId === toId) throw new ApiError("Elegí otra finanza");
  await ctx.assert({ householdId: toId }, "create");
  await ensurePlanDefaults(toId);
  const fromId = resource.householdId;
  const from = await prisma.household.findUniqueOrThrow({ where: { id: fromId } });
  return prisma.$transaction(async (tx) => {
    if (kind === "account") {
      const account = await tx.planAccount.findUniqueOrThrow({ where: { id } });
      if (account.householdId !== fromId) throw new ApiError("La cuenta cambió; volvé a cargar", 409);
      const entries = await tx.planEntry.findMany({ where: { accountId: id } });
      const ruleIds = [...new Set(entries.flatMap((e) => e.recurringId ? [e.recurringId] : []))];
      const loanIds = [...new Set(entries.flatMap((e) => e.loanId ? [e.loanId] : []))];
      const related = await tx.planEntry.findMany({ where: { OR: [{ recurringId: { in: ruleIds } }, { loanId: { in: loanIds } }] } });
      if (related.some((e) => e.accountId && e.accountId !== id)) throw new ApiError("Un fijo o préstamo usa otra cuenta. Unificá sus movimientos antes de trasladar la cuenta.", 409);
      const all = [...new Map([...entries, ...related].map((e) => [e.id, e])).values()];
      const categories = await mapCategoriesByName(tx, fromId, toId, all.flatMap((e) => [e.categoryId, e.targetCategoryId]).filter((c): c is string => !!c));
      const remap = (c: string | null) => c ? categories.get(c) ?? null : null;
      await ensureMoveMonths(tx, fromId, toId, all.map((e) => e.period));
      for (const e of all) await tx.planEntry.update({ where: { id: e.id }, data: { householdId: toId, categoryId: remap(e.categoryId), targetCategoryId: remap(e.targetCategoryId), originFinanceName: e.originFinanceName ?? from.name } });
      const rules = await tx.planRecurring.findMany({ where: { id: { in: ruleIds } } });
      for (const r of rules) await tx.planRecurring.update({ where: { id: r.id }, data: { householdId: toId, categoryId: remap(r.categoryId), targetCategoryId: remap(r.targetCategoryId) } });
      const loans = await tx.planLoan.findMany({ where: { id: { in: loanIds } } });
      for (const l of loans) await tx.planLoan.update({ where: { id: l.id }, data: { householdId: toId, categoryId: remap(l.categoryId) } });
      const historical = await tx.planCardPayment.findMany({ where: { accountId: id } });
      for (const payment of historical) await tx.planCardPayment.update({ where: { id: payment.id }, data: { householdId: toId, originFinanceName: payment.originFinanceName ?? from.name } });
      const transfers = await tx.planAccountTransfer.findMany({ where: { OR: [{ fromAccountId: id }, { toAccountId: id }] } });
      for (const transfer of transfers) await tx.planAccountTransfer.update({ where: { id: transfer.id }, data: { householdId: toId, originFinanceName: transfer.originFinanceName ?? from.name } });
      await tx.planAccount.update({ where: { id }, data: { householdId: toId, originFinanceName: account.originFinanceName ?? from.name } });
      return { ok: true, moved: all.length, originFinanceName: from.name };
    }
    const card = await tx.card.findUniqueOrThrow({ where: { id } });
    if (card.householdId !== fromId) throw new ApiError("La tarjeta cambió; volvé a cargar", 409);
    const purchases = await tx.planCardPurchase.findMany({ where: { cardId: id } });
    const statements = await tx.planCardStatement.findMany({ where: { cardId: id } });
    const categories = await mapCategoriesByName(tx, fromId, toId, purchases.flatMap((p) => p.categoryId ? [p.categoryId] : []));
    await ensureMoveMonths(tx, fromId, toId, statements.map((s) => s.period));
    for (const p of purchases) await tx.planCardPurchase.update({ where: { id: p.id }, data: { householdId: toId, categoryId: p.categoryId ? categories.get(p.categoryId) ?? null : null, originFinanceName: p.originFinanceName ?? from.name } });
    for (const st of statements) await tx.planCardStatement.update({ where: { id: st.id }, data: { householdId: toId, originFinanceName: st.originFinanceName ?? from.name } });
    await tx.card.update({ where: { id }, data: { householdId: toId, originFinanceName: card.originFinanceName ?? from.name } });
    // Se reclasifica el historial del pago, conservando su cuenta real y el saldo de esa cuenta.
    const historical = await tx.planCardPayment.findMany({ where: { statement: { cardId: id } } });
    for (const payment of historical) await tx.planCardPayment.update({ where: { id: payment.id }, data: { householdId: toId, originFinanceName: payment.originFinanceName ?? from.name } });
    await tx.planInboxRule.deleteMany({ where: { cardId: id } });
    return { ok: true, moved: purchases.length + statements.length, originFinanceName: from.name };
  }, { isolationLevel: "Serializable" });
}
