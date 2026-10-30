import test from "node:test";
import assert from "node:assert/strict";
import {
  addMonths,
  cardMonth,
  cardsTotals,
  committedByMonth,
  daysUntil,
  installmentFor,
  installmentsInPeriod,
  itemShare,
  monthsBetween,
  statementStatus,
  toArs,
  wealthDelta,
  wealthTotals,
} from "../selectors.ts";
import type { CardPurchase, CardsOverview, CardStatement, WealthItem } from "../types.ts";

const purchase = (over: Partial<CardPurchase> = {}): CardPurchase => ({
  id: "p", cardId: "a", description: "x", categoryName: null, currency: "ARS", total: 600, installments: 6, firstPeriod: "2026-09", ...over,
});
const statement = (over: Partial<CardStatement> = {}): CardStatement => ({
  period: "2026-11", dueDate: "2026-11-10", totalArs: 1000, minimumArs: null, usdAmount: null, isPaid: false, ...over,
});

const overview: CardsOverview = {
  period: "2026-11",
  today: "2026-11-03",
  usdRate: 1000,
  cards: [
    { id: "a", name: "A", entity: null, brand: "VISA", owner: null },
    { id: "b", name: "B", entity: null, brand: "MC", owner: null },
    { id: "c", name: "C", entity: null, brand: null, owner: null },
  ],
  statements: [
    { cardId: "a", ...statement({ totalArs: 500 }) },
    { cardId: "b", ...statement({ totalArs: 300, isPaid: true }) },
  ],
  purchases: [
    purchase({ id: "p1", cardId: "a", total: 600, installments: 6, firstPeriod: "2026-09" }),
    purchase({ id: "p2", cardId: "c", total: 2400, installments: 12, firstPeriod: "2026-03" }),
    purchase({ id: "p3", cardId: "c", currency: "USD", total: 60, installments: 1, firstPeriod: "2026-11" }),
  ],
};

test("addMonths / monthsBetween cruzan el año", () => {
  assert.equal(addMonths("2026-11", 2), "2027-01");
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.equal(addMonths("2026-06", 0), "2026-06");
  assert.equal(addMonths("2026-12", 12), "2027-12");
  assert.equal(monthsBetween("2026-10", "2027-02"), 4);
  assert.equal(monthsBetween("2027-02", "2026-10"), -4);
});

test("installmentFor: número, total y rango", () => {
  const p = purchase();
  assert.deepEqual(installmentFor(p, "2026-09"), { number: 1, of: 6, amount: 100 });
  assert.deepEqual(installmentFor(p, "2027-02"), { number: 6, of: 6, amount: 100 });
  assert.equal(installmentFor(p, "2026-08"), null);
  assert.equal(installmentFor(p, "2027-03"), null);
  assert.equal(installmentFor(purchase({ total: 100, installments: 3 }), "2026-09")?.amount, 33.33);
  assert.equal(installmentFor(purchase({ installments: 0 }), "2026-09"), null);
});

test("toArs", () => {
  assert.equal(toArs(10, "USD", 1450), 14_500);
  assert.equal(toArs(10, "ARS", 1450), 10);
});

test("cardMonth: resumen, proyectado y cantidad de cuotas", () => {
  const a = cardMonth(overview, "a", "2026-11");
  assert.equal(a.statement?.totalArs, 500);
  assert.equal(a.projectedArs, 100);
  assert.equal(a.installmentsCount, 1);
  const c = cardMonth(overview, "c", "2026-11");
  assert.equal(c.statement, null);
  assert.equal(c.projectedArs, 200 + 60_000);
  assert.equal(c.installmentsCount, 2);
  assert.deepEqual(cardMonth(overview, "b", "2026-11").installmentsCount, 0);
});

test("daysUntil", () => {
  assert.equal(daysUntil("2026-11-10", "2026-11-03"), 7);
  assert.equal(daysUntil("2026-11-03", "2026-11-03"), 0);
  assert.equal(daysUntil("2026-10-30", "2026-11-03"), -4);
  assert.equal(daysUntil("2027-01-01", "2026-12-31"), 1);
});

test("statementStatus", () => {
  const today = "2026-11-03";
  assert.equal(statementStatus(statement({ isPaid: true }), 0, today), "paid");
  assert.equal(statementStatus(statement({ dueDate: "2026-11-02" }), 0, today), "overdue");
  assert.equal(statementStatus(statement({ dueDate: "2026-11-03" }), 0, today), "dueSoon");
  assert.equal(statementStatus(statement({ dueDate: "2026-11-08" }), 0, today), "dueSoon");
  assert.equal(statementStatus(statement({ dueDate: "2026-11-09" }), 0, today), "upcoming");
  assert.equal(statementStatus(statement({ dueDate: null }), 0, today), "upcoming");
  assert.equal(statementStatus(null, 100, today), "estimated");
  assert.equal(statementStatus(null, 0, today), "empty");
});

test("cardsTotals: pagado, por pagar y estimado", () => {
  assert.deepEqual(cardsTotals(overview, "2026-11"), { toPay: 500 + 60_200, paid: 300, total: 500 + 60_200 + 300, estimated: 60_200 });
  assert.deepEqual(cardsTotals(overview, "2027-01"), { toPay: 300, paid: 0, total: 300, estimated: 300 });
});

test("committedByMonth: cuotas en ARS por mes", () => {
  const r = committedByMonth(overview.purchases, "2026-11", 3, 1000);
  assert.deepEqual(r.map((x) => x.period), ["2026-11", "2026-12", "2027-01"]);
  assert.deepEqual(r.map((x) => x.amount), [60_300, 300, 300]);
  assert.deepEqual(committedByMonth([], "2026-11", 0, 1000), []);
});

test("installmentsInPeriod: ordenadas por monto en ARS desc", () => {
  const r = installmentsInPeriod(overview, "2026-11");
  assert.deepEqual(r.map((x) => x.purchase.id), ["p3", "p2", "p1"]);
  assert.equal(r[0].number, 1);
  assert.equal(r[0].amount, 60);
  assert.equal(r[1].number, 9);
});

const items: WealthItem[] = [
  { id: "1", kind: "asset", source: "manual", name: "a", currency: "ARS", amount: 1000, previous: 900 },
  { id: "2", kind: "asset", source: "manual", name: "b", currency: "USD", amount: 1, previous: null },
  { id: "3", kind: "debt", source: "loan", name: "c", currency: "ARS", amount: 500, previous: 600 },
];

test("wealthTotals", () => {
  assert.deepEqual(wealthTotals(items, 1000), { assets: 2000, debts: 500, net: 1500 });
  assert.deepEqual(wealthTotals([], 1000), { assets: 0, debts: 0, net: 0 });
});

test("wealthDelta", () => {
  assert.deepEqual(wealthDelta([{ period: "a", netArs: 100 }, { period: "b", netArs: 125 }]), { amount: 25, ratio: 0.25 });
  assert.deepEqual(wealthDelta([{ period: "a", netArs: -100 }, { period: "b", netArs: -50 }]), { amount: 50, ratio: 0.5 });
  assert.deepEqual(wealthDelta([{ period: "a", netArs: 0 }, { period: "b", netArs: 50 }]), { amount: 50, ratio: null });
  assert.equal(wealthDelta([{ period: "a", netArs: 1 }]), null);
  assert.equal(wealthDelta([]), null);
});

test("itemShare: dentro de su grupo", () => {
  assert.equal(itemShare(items[0], items, 1000), 0.5);
  assert.equal(itemShare(items[1], items, 1000), 0.5);
  assert.equal(itemShare(items[2], items, 1000), 1);
  assert.equal(itemShare({ ...items[2], amount: 0 }, [{ ...items[2], amount: 0 }], 1000), 0);
});
