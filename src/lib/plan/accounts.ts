import type { Prisma, PlanAccount } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { todayIso } from "./core";
import { ApiError } from "./api-error";
import { assertAccess, canAccess } from "./access";
import type { ApiContext } from "./server";
import type { AccountDTO, AccountMovementDTO } from "./account-types";

export type AccountTx = Prisma.TransactionClient;
export const ACCOUNT_TYPES = ["BANK", "WALLET", "CASH", "OTHER"] as const;
export const TRANSFER_KINDS = ["TRANSFER", "CASH_WITHDRAWAL", "BUY_USD"] as const;
export const accountRequired = () => process.env.ACCOUNT_REQUIRED === "true";

/** SQL numeric conserva centavos; el corte es saldo al comienzo de openingDate. */
export async function accountBalance(id: string, db: AccountTx = prisma): Promise<number> {
  const rows = await db.$queryRaw<{ balance: Prisma.Decimal }[]>`
    SELECT a."openingBalance" + COALESCE((SELECT SUM(CASE WHEN e.kind = 'INCOME' THEN e.amount ELSE -e.amount END)
      FROM "PlanEntry" e WHERE e."accountId" = a.id AND e."isDone" AND (a."openingDate" IS NULL OR COALESCE(e."collectedAt", e."paidAt", e.date, CASE WHEN e.period = to_char(e."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM') THEN (e."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')::date ELSE to_date(e.period || '-01', 'YYYY-MM-DD') END) >= a."openingDate")), 0)
      + COALESCE((SELECT SUM(t."amountTo") FROM "PlanAccountTransfer" t WHERE t."toAccountId" = a.id AND (a."openingDate" IS NULL OR t.date >= a."openingDate")), 0)
      - COALESCE((SELECT SUM(t."amountFrom") FROM "PlanAccountTransfer" t WHERE t."fromAccountId" = a.id AND (a."openingDate" IS NULL OR t.date >= a."openingDate")), 0)
      - COALESCE((SELECT SUM(p.amount) FROM "PlanCardPayment" p WHERE p."accountId" = a.id AND (a."openingDate" IS NULL OR (p."paidAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')::date >= a."openingDate")), 0) AS balance
    FROM "PlanAccount" a WHERE a.id = ${id}`;
  if (!rows.length) throw new ApiError("Cuenta no encontrada", 404);
  return Number(rows[0].balance);
}

export async function accountDTO(a: PlanAccount & { household: { name: string } }, userId: string): Promise<AccountDTO> {
  return { id: a.id, name: a.name, ownerUserId: a.ownerUserId, householdId: a.householdId, financeName: a.household.name,
    type: a.type, currency: a.currency, openingBalance: Number(a.openingBalance), openingDate: a.openingDate?.toISOString().slice(0, 10) ?? null,
    balance: await accountBalance(a.id), isArchived: a.isArchived, isOwner: a.ownerUserId === userId, originFinanceName: a.originFinanceName };
}
export async function listAccounts(ctx: ApiContext, onlyActive = false): Promise<AccountDTO[]> {
  const recent = await prisma.planEntry.findMany({ where: { householdId: ctx.householdId, isDone: true, accountId: { not: null } }, distinct: ["accountId"], orderBy: { createdAt: "desc" }, take: 100, select: { accountId: true } });
  const rows = await prisma.planAccount.findMany({ where: {
    ...(ctx.finance.kind === "PERSONAL" && !onlyActive ? { OR: [{ householdId: ctx.householdId }, { ownerUserId: ctx.userId }] } : { householdId: ctx.householdId }),
  }, include: { household: { select: { name: true } } }, orderBy: [{ isArchived: "asc" }, { createdAt: "asc" }] });
  rows.sort((a, b) => { const index = (id: string) => { const i = recent.findIndex((e) => e.accountId === id); return i < 0 ? 10000 : i; }; return index(a.id) - index(b.id); });
  return Promise.all(rows.map((a) => accountDTO(a, ctx.userId)));
}
export async function requireAccount(id: unknown, householdId: string, currency: "ARS" | "USD", done: boolean, db: AccountTx = prisma): Promise<string | null> {
  if (id == null || id === "") {
    if (done && accountRequired()) throw new ApiError("Elegí una cuenta");
    return null;
  }
  if (typeof id !== "string") throw new ApiError("Cuenta inválida");
  const a = await db.planAccount.findUnique({ where: { id } });
  if (!a || a.householdId !== householdId || a.isArchived) throw new ApiError("Elegí una cuenta activa de esta finanza");
  if (a.currency !== currency) throw new ApiError("La moneda de la cuenta no coincide con el movimiento");
  return a.id;
}
export async function assertAccount(ctx: ApiContext, id: string, manage = false) {
  const a = await prisma.planAccount.findUnique({ where: { id }, include: { household: { select: { name: true } } } });
  if (!a) throw new ApiError("Cuenta no encontrada", 404);
  if (manage || a.ownerUserId !== ctx.userId) await ctx.assert(a, manage ? "update" : "read");
  if (manage && a.ownerUserId !== ctx.userId) throw new ApiError("Solo el dueño administra esta cuenta", 403);
  return a;
}
export async function assertResourceOwner(ctx: ApiContext, resource: { householdId: string; ownerUserId: string | null } | null) {
  if (!resource) throw new ApiError("No encontrado", 404);
  await assertAccess({ id: ctx.userId }, resource, "update");
  const owner = resource.ownerUserId ?? (await prisma.household.findUnique({ where: { id: resource.householdId }, select: { ownerUserId: true } }))?.ownerUserId;
  if (owner !== ctx.userId) throw new ApiError("Solo el dueño administra este recurso", 403);
}

export async function accountMovements(ctx: ApiContext, id: string): Promise<AccountMovementDTO[]> {
  const account = await assertAccount(ctx, id);
  const [entries, transfers, payments] = await Promise.all([
    prisma.planEntry.findMany({ where: { accountId: id, isDone: true }, include: { household: { select: { name: true } } } }),
    prisma.planAccountTransfer.findMany({ where: { OR: [{ fromAccountId: id }, { toAccountId: id }] } }),
    prisma.planCardPayment.findMany({ where: { accountId: id }, include: { household: { select: { name: true } } } }),
  ]);
  const readable = new Map<string, boolean>();
  for (const e of [...entries, ...payments]) if (!readable.has(e.householdId)) readable.set(e.householdId, await canAccess({ id: ctx.userId }, e, "read"));
  const result: AccountMovementDTO[] = entries.map((e) => ({ id: e.id, type: "ENTRY", name: readable.get(e.householdId) ? e.name : "Otra finanza",
    amount: Number(e.amount) * (e.kind === "INCOME" ? 1 : -1), currency: e.currency,
    date: e.collectedAt?.toISOString().slice(0, 10) ?? e.paidAt?.toISOString().slice(0, 10) ?? e.date?.toISOString().slice(0, 10) ?? null, householdId: readable.get(e.householdId) ? e.householdId : null,
    financeName: readable.get(e.householdId) ? e.household.name : null, originFinanceName: readable.get(e.householdId) ? e.originFinanceName : null, masked: !readable.get(e.householdId) }));
  for (const t of transfers) result.push({ id: t.id, type: "TRANSFER", name: t.kind === "CASH_WITHDRAWAL" ? "Retiro de efectivo" : t.kind === "BUY_USD" ? "Cambio de moneda" : "Transferencia", amount: Number(t.fromAccountId === id ? t.amountFrom : t.amountTo) * (t.fromAccountId === id ? -1 : 1), currency: account.currency, date: t.date.toISOString().slice(0, 10), householdId: null, financeName: null, originFinanceName: t.originFinanceName });
  for (const p of payments) result.push({ id: p.id, type: "CARD_PAYMENT", name: "Pago de tarjeta", amount: -Number(p.amount), currency: p.currency, date: todayIso(p.paidAt), householdId: readable.get(p.householdId) ? p.householdId : null, financeName: readable.get(p.householdId) ? p.household.name : null, originFinanceName: readable.get(p.householdId) ? p.originFinanceName : null, masked: !readable.get(p.householdId) });
  return result.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/** Últimos movimientos de todas las cuentas visibles (para la pantalla Plata), con el nombre de la cuenta. */
export async function recentAccountMovements(ctx: ApiContext, limit = 8): Promise<(AccountMovementDTO & { accountId: string; accountName: string })[]> {
  const accounts = (await listAccounts(ctx, false)).filter((a) => !a.isArchived).slice(0, 12);
  const lists = await Promise.all(accounts.map(async (a) => (await accountMovements(ctx, a.id)).map((m) => ({ ...m, accountId: a.id, accountName: a.name }))));
  return lists.flat().sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, Math.min(Math.max(limit, 1), 30));
}
