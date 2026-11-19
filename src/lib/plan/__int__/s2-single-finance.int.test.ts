/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
import { currentPeriod, todayIso, buildSummary, addMonths } from "../core";
import type { TestUser } from "./harness";
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.ACCOUNT_REQUIRED = "true";
const { assertLocalDb, call, cleanup, makeUser } = require("./harness") as typeof import("./harness");
assertLocalDb();
const { prisma } = require("@/lib/prisma") as typeof import("@/lib/prisma");
const { accountBalance } = require("../accounts") as typeof import("../accounts");
const { loadPlan } = require("../server") as typeof import("../server");
const { backfillSingleFinance } = require("../../../../prisma/backfill/s2-single-finance") as typeof import("../../../../prisma/backfill/s2-single-finance");
const route = (p: string) => require(`@/app/api/plan/${p}/route`) as Record<string, Parameters<typeof call>[0]>;
const period = currentPeriod();
let owner: TestUser, editor: TestUser, viewer: TestUser, stranger: TestUser;
let home: string, ars: string, second: string, usd: string, homeAccount: string, expenseId: string, cardId: string, statementId: string;
const request = (p: string, method: string, user: TestUser, body?: unknown, id?: string, finance?: string) => call(route(p)[method], user, { method, body, params: id ? { id } : {}, finance });
beforeAll(async () => {
 [owner, editor, viewer, stranger] = await Promise.all([makeUser("S2Owner"), makeUser("S2Editor"), makeUser("S2Viewer"), makeUser("S2Stranger")]);
 const r = await request("finances", "POST", owner, { name: `Hogar-${owner.id}` }); home = r.json.finance.id;
 await prisma.financeMember.createMany({ data: [{ userId: editor.id, householdId: home, role: "EDITOR" }, { userId: viewer.id, householdId: home, role: "VIEWER" }] });
 for (const householdId of [owner.personalId, home]) await prisma.planMonth.create({ data: { householdId, period, usdRate: 1200 } });
});
afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

it("crea cuentas con pertenencia exclusiva y dueño; rechaza monedas y accesos inválidos", async () => {
 const a = await request("accounts", "POST", owner, { name: "Banco", openingBalance: 1000 }); expect(a.status).toBe(201); ars = a.json.id;
 second = (await request("accounts", "POST", owner, { name: "Billetera", type: "WALLET" })).json.id;
 usd = (await request("accounts", "POST", owner, { name: "Dólares", currency: "USD" })).json.id;
 homeAccount = (await request("accounts", "POST", owner, { name: "Hogar" }, undefined, home)).json.id;
 expect((await request("accounts", "POST", owner, { name: "Bad", currency: "EUR" })).status).toBe(400);
 expect((await request("accounts", "POST", viewer, { name: "Bad" }, undefined, home)).status).toBe(403);
 expect((await request("accounts/[id]", "GET", stranger, undefined, ars)).status).toBe(404);
 expect(await accountBalance(ars)).toBe(1000);
});

it("ingresos cobrados y gastos hechos afectan saldo; pendientes no; valida cuenta y moneda", async () => {
 const salary = await request("entries", "POST", owner, { kind: "INCOME", period, name: "Sueldo", amount: 500, fixed: { frequency: "MONTHLY" }, isDone: true, collectedAt: todayIso(), accountId: ars }); expect(salary.status).toBe(201);
 const expense = await request("entries", "POST", owner, { kind: "EXPENSE", period, name: "Compra", amount: 100, accountId: ars }); expect(expense.status).toBe(201); expenseId = expense.json.id;
 expect(await accountBalance(ars)).toBe(1400);
 const fixed = await request("entries", "POST", owner, { kind: "EXPENSE", period, name: "Fijo", amount: 30, fixed: { frequency: "MONTHLY" } }); expect(fixed.status).toBe(201);
 expect(await accountBalance(ars)).toBe(1400);
 expect((await request("entries/[id]", "PATCH", owner, { isDone: true }, fixed.json.id)).status).toBe(400);
 expect((await request("entries", "POST", owner, { kind: "EXPENSE", period, name: "Bad", amount: 1, currency: "USD", accountId: ars })).status).toBe(400);
 expect((await request("entries", "POST", owner, { kind: "EXPENSE", period, name: "Bad", amount: 1, accountId: homeAccount })).status).toBe(400);
 expect((await request("entries", "POST", owner, { kind: "EXPENSE", period, name: "Bad", amount: 1 })).status).toBe(400);
 expect((await request("accounts/[id]", "PATCH", owner, { isArchived: true }, ars)).status).toBe(409);
 expect((await request("accounts/[id]", "DELETE", owner, undefined, ars)).status).toBe(409);
});

it("editores usan cuentas de la finanza pero no las administran; lectores no operan", async () => {
 expect((await request("entries", "POST", editor, { kind: "EXPENSE", period, name: "Hogar", amount: 10, accountId: homeAccount }, undefined, home)).status).toBe(201);
 expect((await request("accounts/[id]", "PATCH", editor, { name: "Robada" }, homeAccount, home)).status).toBe(403);
 expect((await request("entries", "POST", viewer, { kind: "EXPENSE", period, name: "Bad", amount: 1, accountId: homeAccount }, undefined, home)).status).toBe(403);
});

it("transferencias, efectivo y cambio de moneda conservan centavos sin crear gasto del presupuesto", async () => {
 const before = buildSummary(await loadPlan(owner.personalId, period));
 const moved = await request("account-transfers", "POST", owner, { fromAccountId: ars, toAccountId: second, amountFrom: 100, kind: "TRANSFER", date: todayIso() }); expect(moved.status).toBe(201);
 expect(await accountBalance(ars)).toBe(1300); expect(await accountBalance(second)).toBe(100);
 const cash = await request("account-transfers", "POST", owner, { fromAccountId: ars, amountFrom: 20, kind: "CASH_WITHDRAWAL" }); expect(cash.status).toBe(201);
 const cashAccount = await prisma.planAccount.findFirstOrThrow({ where: { ownerUserId: owner.id, type: "CASH" } }); expect(await accountBalance(cashAccount.id)).toBe(20);
 const fx = await request("account-transfers", "POST", owner, { fromAccountId: ars, toAccountId: usd, amountFrom: 120, amountTo: 0.1, kind: "BUY_USD" }); expect(fx.status).toBe(201);
 expect(await accountBalance(usd)).toBe(0.1);
 const row = await prisma.planAccountTransfer.findUniqueOrThrow({ where: { id: fx.json.id } }); expect(Number(row.rate)).toBe(1200);
 await prisma.planMonth.update({ where: { householdId_period: { householdId: owner.personalId, period } }, data: { usdRate: 1300 } }); expect(Number((await prisma.planAccountTransfer.findUniqueOrThrow({ where: { id: row.id } })).rate)).toBe(1200);
 expect(buildSummary(await loadPlan(owner.personalId, period)).paidArs).toBe(before.paidArs);
 expect((await request("account-transfers/[id]", "DELETE", owner, undefined, fx.json.id)).status).toBe(200); expect(await accountBalance(usd)).toBe(0);
 expect((await request("account-transfers", "POST", owner, { fromAccountId: ars, toAccountId: homeAccount, amountFrom: 1 })).status).toBe(400);
 expect((await request("account-transfers", "POST", owner, { fromAccountId: ars, toAccountId: usd, amountFrom: 1 })).status).toBe(400);
});

it("pago de resumen registra una salida por moneda y deshacer devuelve el saldo", async () => {
 cardId = (await request("cards", "POST", owner, { entity: "Banco", ownerName: owner.name, cardType: "VISA" })).json.id;
 const st = await request("card-statements", "POST", owner, { cardId, period, totalArs: 100, usdAmount: 2, dueDate: todayIso() }); expect(st.status).toBe(201); statementId = st.json.id;
 const before = await accountBalance(ars);
 expect((await request("card-statements/[id]", "PATCH", owner, { isPaid: true }, statementId)).status).toBe(400);
 expect((await request("card-statements/[id]/pay", "POST", owner, { accountId: ars, usdAccountId: usd }, statementId)).status).toBe(200);
 expect(await accountBalance(ars)).toBe(before - 100); expect(await accountBalance(usd)).toBe(-2);
 expect(await prisma.planCardPayment.count({ where: { statementId } })).toBe(2);
 const paymentDates = await prisma.planCardPayment.findMany({ where: { statementId } });
 expect(paymentDates.every((p) => todayIso(p.paidAt) === todayIso())).toBe(true);
 expect(new Set(paymentDates.map((p) => p.paidAt.toISOString())).size).toBe(1);
 expect((await request("card-statements/[id]/pay", "POST", owner, { accountId: ars }, statementId)).status).toBe(409);
 expect((await request("card-statements/[id]", "PATCH", owner, { totalArs: 999 }, statementId)).status).toBe(409);
 expect((await request("card-statements/[id]", "DELETE", owner, undefined, statementId)).status).toBe(409);
 expect((await request("card-statements/[id]/unpay", "POST", owner, {}, statementId)).status).toBe(200);
 expect(await accountBalance(ars)).toBe(before); expect(await accountBalance(usd)).toBe(0);
});

it("mover un gasto lo reclasifica completo con cuenta destino y marca de origen", async () => {
 const fromBalance = await accountBalance(ars), toBalance = await accountBalance(homeAccount);
 expect((await request("entries/move", "POST", owner, { entryIds: [expenseId], toFinanceId: home })).status).toBe(400);
 const r = await request("entries/move", "POST", owner, { entryIds: [expenseId], toFinanceId: home, accountId: homeAccount }); expect(r.status).toBe(200);
 const entry = await prisma.planEntry.findUniqueOrThrow({ where: { id: expenseId } }); expect(entry.householdId).toBe(home); expect(entry.originFinanceName).toBeTruthy(); expect(Number(entry.amount)).toBe(100);
 expect(await accountBalance(ars)).toBe(fromBalance + 100); expect(await accountBalance(homeAccount)).toBe(toBalance - 100);
 expect((await loadPlan(owner.personalId, period)).entries.some((e) => e.id === expenseId)).toBe(false);
});

it("mover cuenta traslada todo su historial y regla sin cambiar su saldo ni dueño", async () => {
 const before = await accountBalance(ars); const count = await prisma.planEntry.count({ where: { accountId: ars } });
 const r = await request("accounts/[id]/move", "POST", owner, { toFinanceId: home }, ars); expect(r.status).toBe(200);
 expect(await accountBalance(ars)).toBe(before);
 const account = await prisma.planAccount.findUniqueOrThrow({ where: { id: ars } }); expect(account).toMatchObject({ householdId: home, ownerUserId: owner.id, originFinanceName: expect.any(String) });
 expect(await prisma.planEntry.count({ where: { accountId: ars, householdId: home } })).toBe(count);
 const list = await request("accounts", "GET", owner); expect(list.json.accounts.some((a: { id: string }) => a.id === ars)).toBe(true);
 const personal = await call(route("accounts").GET, owner, { url: "http://localhost/api/plan/accounts?activeOnly=1" }); expect(personal.json.accounts.some((a: { id: string }) => a.id === ars)).toBe(false);
 const original = account.originFinanceName;
 expect((await request("accounts/[id]/move", "POST", owner, { toFinanceId: owner.personalId }, ars)).status).toBe(200);
 expect((await prisma.planAccount.findUniqueOrThrow({ where: { id: ars } })).originFinanceName).toBe(original);
});

it("mover tarjeta incluye compras y resúmenes y conserva el dinero real de pagos anteriores", async () => {
 const p = await request("card-purchases", "POST", owner, { cardId, description: "Compra tarjeta", amount: 100, installments: 2, firstPeriod: period }); expect(p.status).toBe(201);
 expect((await request("card-statements/[id]/pay", "POST", owner, { accountId: ars, usdAccountId: usd }, statementId)).status).toBe(200);
 const balance = await accountBalance(ars);
 expect((await request("cards/[id]/move", "POST", owner, { toFinanceId: home }, cardId)).status).toBe(200);
 expect(await accountBalance(ars)).toBe(balance);
 expect((await prisma.planCardPurchase.findUniqueOrThrow({ where: { id: p.json.id } })).householdId).toBe(home);
 expect((await prisma.planCardStatement.findUniqueOrThrow({ where: { id: statementId } })).householdId).toBe(home);
 const list = await request("cards", "GET", owner); expect(list.json.cards.some((c: { id: string; householdId: string }) => c.id === cardId && c.householdId === home)).toBe(true);
 const sourcePlan = await loadPlan(owner.personalId, period); const targetPlan = await loadPlan(home, period);
 expect(sourcePlan.cards.some((c) => c.id === cardId)).toBe(false);
 expect(sourcePlan.cardPayments?.some((p) => p.statementId === statementId)).toBe(false);
 expect(targetPlan.cardPayments?.filter((p) => p.statementId === statementId)).toHaveLength(2);
 expect(targetPlan.statements.find((s) => s.id === statementId)?.payments?.[0].accountName).toBe("Cuenta de origen");
});

it("saldo inicial con fecha de corte ignora operaciones anteriores y el detalle las conserva", async () => {
 const a = (await request("accounts", "POST", owner, { name: "Saldo de hoy", openingBalance: 100, openingDate: todayIso() })).json.id;
 await prisma.planEntry.create({ data: { householdId: owner.personalId, period, name: "Anterior", kind: "EXPENSE", amount: 20, date: new Date("2026-01-01T00:00:00Z"), isDone: true, accountId: a } });
 expect(await accountBalance(a)).toBe(100);
 const detail = await request("accounts/[id]", "GET", owner, undefined, a); expect(detail.json.movements.length).toBe(1);
 await request("entries", "POST", owner, { kind: "INCOME", name: "Centavos", amount: 0.1, accountId: a, period });
 await request("entries", "POST", owner, { kind: "INCOME", name: "Centavos", amount: 0.2, accountId: a, period });
 expect(await accountBalance(a)).toBe(100.3);
});

it("backfill simula con rollback y repetirlo no duplica cuentas, pagos ni movimientos", async () => {
 const legacy = await prisma.planEntry.create({ data: { householdId: owner.personalId, period, name: "Legado", kind: "EXPENSE", amount: 1, isDone: true } });
 const count = await prisma.planAccount.count(); const dry = await backfillSingleFinance(prisma, true); expect(dry.entries).toBeGreaterThan(0); expect(await prisma.planAccount.count()).toBe(count); expect((await prisma.planEntry.findUniqueOrThrow({ where: { id: legacy.id } })).accountId).toBeNull();
 await backfillSingleFinance(prisma, false);
 const again = await backfillSingleFinance(prisma, false); expect(again).toEqual({ accounts: 0, entries: 0, cards: 0, payments: 0 });
});


it("el dueño ve su cuenta desde Personal tras perder membresía, con movimientos ajenos enmascarados", async () => {
 const a = await request("accounts", "POST", editor, { name: "Cuenta propia del editor" }, undefined, home);
 expect(a.status).toBe(201);
 await request("entries", "POST", owner, { kind: "EXPENSE", name: "Detalle privado", amount: 15, period, accountId: a.json.id }, undefined, home);
 await prisma.financeMember.delete({ where: { userId_householdId: { userId: editor.id, householdId: home } } });
 const listing = await request("accounts", "GET", editor); expect(listing.json.accounts.some((x: { id: string }) => x.id === a.json.id)).toBe(true);
 const detail = await request("accounts/[id]", "GET", editor, undefined, a.json.id);
 expect(detail.status).toBe(200); expect(detail.json.account.balance).toBe(-15);
 expect(detail.json.movements[0]).toMatchObject({ masked: true, name: "Otra finanza", householdId: null, financeName: null, amount: -15 });
 expect(JSON.stringify(detail.json.movements)).not.toContain("Detalle privado");
 expect((await request("accounts/[id]/move", "POST", editor, { toFinanceId: editor.personalId }, a.json.id)).status).toBe(404);
});

it("pago convertido guarda el importe efectivo y dos confirmaciones concurrentes no lo duplican", async () => {
 const card = (await request("cards", "POST", owner, { entity: "Concurrente", ownerName: owner.name, cardType: "MC" })).json.id;
 const st = (await request("card-statements", "POST", owner, { cardId: card, period, totalArs: 10, usdAmount: 1 })).json.id;
 const before = await accountBalance(ars);
 const paid = await Promise.all([request("card-statements/[id]/pay", "POST", owner, { accountId: ars }, st), request("card-statements/[id]/pay", "POST", owner, { accountId: ars }, st)]);
 expect(paid.map((r) => r.status).sort()).toEqual([200, 409]);
 const payment = await prisma.planCardPayment.findFirstOrThrow({ where: { statementId: st } });
 expect(await accountBalance(ars)).toBe(before - Number(payment.amount));
 expect(await prisma.planCardPayment.count({ where: { statementId: st } })).toBe(1);
 await prisma.planMonth.update({ where: { householdId_period: { householdId: owner.personalId, period } }, data: { usdRate: 9999 } });
 expect(await accountBalance(ars)).toBe(before - Number(payment.amount));
 expect((await request("card-statements/[id]/unpay", "POST", owner, {}, st)).status).toBe(200);
 expect(await accountBalance(ars)).toBe(before);
});

it("pagar un fijo vencido usa fecha real de pago para el saldo con corte, sin perder vencimiento", async () => {
 const a = (await request("accounts", "POST", owner, { name: "Corte de pago", openingBalance: 100, openingDate: todayIso() })).json.id;
 const entry = await prisma.planEntry.create({ data: { householdId: owner.personalId, period, kind: "EXPENSE", name: "Servicio vencido", amount: 30, date: new Date("2026-01-01T00:00:00Z") } });
 expect((await request("entries/[id]", "PATCH", owner, { isDone: true, accountId: a }, entry.id)).status).toBe(200);
 expect(await accountBalance(a)).toBe(70);
 const saved = await prisma.planEntry.findUniqueOrThrow({ where: { id: entry.id } }); expect(saved.paidAt?.toISOString().slice(0, 10)).toBe(todayIso()); expect(saved.date?.toISOString().slice(0, 10)).toBe("2026-01-01");
 expect((await request("entries/[id]", "PATCH", owner, { isDone: false }, entry.id)).status).toBe(200);
 expect(await accountBalance(a)).toBe(100);
});


it("Personal informa los resúmenes impagos de tarjetas propias en otra finanza sin sumarlos a su presupuesto", async () => {
 const future = await request("card-statements", "POST", owner, { cardId, period: addMonths(period, 1), totalArs: 45, usdAmount: 3 }, undefined, home);
 expect(future.status).toBe(201);
 const list = await request("cards", "GET", owner);
 expect(list.json.cards.find((c: { id: string }) => c.id === cardId)).toMatchObject({ householdId: home, unpaidArs: 45, unpaidUsd: 3 });
 expect((await loadPlan(owner.personalId, period)).cards.some((c) => c.id === cardId)).toBe(false);
});

it("crear desde el selector usa la finanza destino explícita y exige permiso allí", async () => {
 const r = await request("accounts", "POST", owner, { name: "Cuenta destino desde selector", householdId: home, currency: "USD", ownerUserId: stranger.id });
 expect(r.status).toBe(201);
 expect(await prisma.planAccount.findUnique({ where: { id: r.json.id } })).toMatchObject({ householdId: home, ownerUserId: owner.id, currency: "USD" });
 expect((await request("accounts", "POST", viewer, { name: "No permitida", householdId: home })).status).toBe(403);
 expect((await request("accounts", "POST", stranger, { name: "Ajena", householdId: home })).status).toBe(404);
});
