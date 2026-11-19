import type { PrismaClient } from "@prisma/client";
import { assignCardOwner } from "./card-owner";
import { statementToPay } from "../../src/lib/plan/core";

/** Solo complementa relaciones faltantes; no modifica montos, fechas o estados existentes. */
export async function backfillSingleFinance(db: PrismaClient, dryRun = true, log: (message: string) => void = () => {}) {
 const rollback = new Error("DRY_RUN");
 const summary = { accounts: 0, entries: 0, cards: 0, payments: 0 };
 try {
  await db.$transaction(async (tx) => {
   const users = await tx.user.findMany();
   const finances = await tx.household.findMany();
   const ensure = async (householdId: string, ownerUserId: string, currency: "ARS" | "USD") => {
    let a = await tx.planAccount.findFirst({ where: { householdId, ownerUserId, currency, isArchived: false }, orderBy: { createdAt: "asc" } });
    if (!a) { a = await tx.planAccount.create({ data: { householdId, ownerUserId, currency, name: currency === "ARS" ? "Cuenta principal" : "Dólares" } }); summary.accounts++; }
    return a;
   };
   for (const f of finances) {
    if (!f.ownerUserId) throw new Error(`S1 incompleta: ${f.id} no tiene dueño`);
    await ensure(f.id, f.ownerUserId, "ARS");
    const entries = await tx.planEntry.findMany({ where: { householdId: f.id, accountId: null, isDone: true } });
    for (const e of entries) {
     const a = await ensure(f.id, f.ownerUserId, e.currency);
     await tx.planEntry.update({ where: { id: e.id }, data: { accountId: a.id } }); summary.entries++;
    }
    const cards = await tx.card.findMany({ where: { householdId: f.id, ownerUserId: null } });
    for (const c of cards) {
     const { userId, rule } = assignCardOwner(c, users, f.ownerUserId);
     log(`Tarjeta ${c.id} (${c.name}) → usuario ${userId} por ${rule}; finanza ${f.name}`);
     await tx.card.update({ where: { id: c.id }, data: { ownerUserId: userId } }); summary.cards++;
    }
    const statements = await tx.planCardStatement.findMany({ where: { householdId: f.id, isPaid: true, payments: { none: {} } } });
    for (const st of statements) {
     const month = await tx.planMonth.findUnique({ where: { householdId_period: { householdId: f.id, period: st.period } } });
     const amount = statementToPay({ totalArs: Number(st.totalArs), usdAmount: Number(st.usdAmount ?? 0), minimumArs: st.minimumArs == null ? null : Number(st.minimumArs), customAmount: st.customAmount == null ? null : Number(st.customAmount), payMode: st.payMode }, Number(month?.usdRate ?? 0));
     if (Number(st.usdAmount ?? 0) > 0 && !Number(month?.usdRate)) throw new Error(`Resumen ${st.id}: falta tipo de cambio para reconstruir el pago histórico`);
     if (!st.paidAt) throw new Error(`Resumen ${st.id}: falta fecha de pago; revisar antes del backfill`);
     if (amount > 0) {
      const a = await ensure(f.id, f.ownerUserId, "ARS");
      await tx.planCardPayment.create({ data: { statementId: st.id, householdId: f.id, accountId: a.id, currency: "ARS", amount, paidByUserId: f.ownerUserId, paidAt: st.paidAt } }); summary.payments++;
     }
    }
   }
   if (dryRun) throw rollback;
  }, { isolationLevel: "Serializable", timeout: 120000 });
 } catch (e) { if (e !== rollback) throw e; }
 return summary;
}
if (require.main === module) (async () => {
 const { config } = await import("dotenv"); config({ path: ".env.local", override: true, quiet: true }); config({ quiet: true });
 const { prisma } = await import("../../src/lib/prisma");
 try { const apply = process.argv.includes("--apply"); console.log(apply ? "APLICAR" : "SIMULACIÓN", new URL(process.env.DATABASE_URL!).hostname); console.log(await backfillSingleFinance(prisma, !apply, console.log)); }
 finally { await prisma.$disconnect(); }
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
