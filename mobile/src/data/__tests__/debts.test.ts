import test from "node:test";
import assert from "node:assert/strict";
import { cardsDebt, cardsTotals, debtsTotals, equityRatio, loanRow, nestStage, previewLoan, wealthTotals } from "../selectors.ts";
import { mockSource } from "../sources/mock.ts";
import type { CardsOverview, DebtsOverview, NewLoanInput } from "../types.ts";
import type { LoanDTO } from "../../domain/index.ts";

const near = (a: number, b: number, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

const base: LoanDTO = {
  id: "x", direction: "OWE", mode: "FIXED", name: "x", counterpart: null, categoryId: null, currency: "ARS",
  principal: 1200, installments: 12, installmentAmount: 100, interestRate: null, interestFrequency: "MONTHLY",
  startPeriod: "2026-09", dueDay: 5, endDate: null, isClosed: false, note: null, schedule: [], payments: [],
};
const paid = (period: string, amount = 100, interest = 0, isDone = true) => ({ entryId: `e${period}`, period, amount, interest, isDone });

test("loanRow FIXED: cuota del mes propuesta, avance y vencimiento", () => {
  const loan = { ...base, payments: [paid("2026-09"), paid("2026-10")] };
  const r = loanRow(loan, "2026-11", 1450);
  assert.equal(r.capital, 1000);
  assert.equal(r.installmentNumber, 3);
  assert.equal(r.installmentsTotal, 12);
  near(r.paidRatio, 2 / 12);
  assert.deepEqual(r.monthPayment, { amount: 100, interest: 0, dueDate: "2026-11-05", isDone: false });
  assert.equal(r.rate, null);
  assert.equal(r.finished, false);
});

test("loanRow: usa el payment generado del período (isDone) y la tasa", () => {
  const loan = { ...base, interestRate: 55, interestAnnual: true, interestTaxPct: 21, payments: [paid("2026-09", 100, 20, true), paid("2026-10", 100, 18, false)] };
  const r = loanRow(loan, "2026-10", 1450);
  assert.equal(r.installmentNumber, 2);
  assert.deepEqual(r.monthPayment, { amount: 100, interest: 18, dueDate: "2026-10-05", isDone: false });
  assert.deepEqual(r.rate, { pct: 55, annual: true, withTax: true });
  // capital = saldo sin el interés pendiente de la cuota del mes
  assert.equal(r.capital, 1200 + 20 - 100);
});

test("loanRow OPEN: avance = 1 − capital/principal; USD a ARS; sin pago sugerido no hay cuota", () => {
  const open: LoanDTO = { ...base, mode: "OPEN", direction: "OWED", currency: "USD", principal: 300, installments: null, installmentAmount: null, dueDay: null };
  const r = loanRow(open, "2026-11", 1450);
  assert.equal(r.capitalArs, 435_000);
  assert.equal(r.paidRatio, 0);
  assert.equal(r.monthPayment, null);
  assert.equal(r.installmentNumber, null);
  const withPay = loanRow({ ...open, principal: 400, installmentAmount: 50, payments: [paid("2026-10", 100)] }, "2026-11", 1450);
  assert.equal(withPay.capital, 300);
  near(withPay.paidRatio, 0.25);
  assert.equal(withPay.monthPayment?.amount, 100);
});

test("loanRow: terminado", () => {
  const r = loanRow({ ...base, installments: 2, principal: 200, payments: [paid("2026-09"), paid("2026-10")] }, "2026-11", 1);
  assert.equal(r.finished, true);
  assert.equal(r.paidRatio, 1);
  assert.equal(r.monthPayment, null);
});

const cardsOv: CardsOverview = {
  period: "2026-11", today: "2026-11-03", usdRate: 1000,
  cards: [
    { id: "a", name: "A", entity: null, brand: null, owner: null },
    { id: "b", name: "B", entity: null, brand: null, owner: null },
    { id: "c", name: "C", entity: null, brand: null, owner: null },
  ],
  statements: [
    { cardId: "a", period: "2026-11", dueDate: "2026-11-10", totalArs: 500, minimumArs: null, usdAmount: null, isPaid: false },
    { cardId: "b", period: "2026-11", dueDate: "2026-11-07", totalArs: 300, minimumArs: null, usdAmount: null, isPaid: true },
  ],
  purchases: [{ id: "p", cardId: "c", description: "x", categoryName: null, currency: "ARS", total: 600, installments: 3, firstPeriod: "2026-11" }],
};

test("cardsDebt: resúmenes sin pagar + estimado, igual que cardsTotals.toPay", () => {
  const d = cardsDebt(cardsOv, "2026-11");
  assert.deepEqual(d, { count: 2, debtArs: 700, nextDue: "2026-11-10" });
  assert.equal(d.debtArs, cardsTotals(cardsOv, "2026-11").toPay);
  assert.deepEqual(cardsDebt({ ...cardsOv, statements: [], purchases: [] }, "2026-11"), { count: 0, debtArs: 0, nextDue: null });
});

test("debtsTotals: capital, cuotas del mes y pagado", () => {
  const owe = { ...base, id: "o", payments: [paid("2026-09"), paid("2026-10"), paid("2026-11")] };
  const pending = { ...base, id: "p", payments: [paid("2026-09")] };
  const owed: LoanDTO = { ...base, id: "d", direction: "OWED", principal: 400, installments: 4, installmentAmount: 100 };
  const ov: DebtsOverview = { period: "2026-11", today: "2026-11-03", usdRate: 1000, loans: [owe, pending, owed], cards: { count: 1, debtArs: 700, nextDue: null } };
  const t = debtsTotals(ov);
  assert.equal(t.oweArs, 900 + 1100 + 700);
  assert.equal(t.owedArs, 400);
  assert.equal(t.monthToPayArs, 100 + 700);
  assert.equal(t.monthToCollectArs, 100);
  assert.equal(t.paidThisMonthArs, 100);
});

const input = (over: Partial<NewLoanInput> = {}): NewLoanInput => ({
  direction: "OWE", mode: "FIXED", name: "x", counterpart: null, currency: "ARS", principal: 1200, installments: 12,
  installmentAmount: null, interestRate: null, interestAnnual: false, interestTaxPct: null, startPeriod: "2026-11", dueDay: null, endDate: null, ...over,
});

test("previewLoan FIXED: sin interés y con interés (francés)", () => {
  assert.deepEqual(previewLoan(input()), { installment: 100, totalToPay: 1200, totalInterest: 0, endPeriod: "2027-10" });
  const p = previewLoan(input({ principal: 7_088_235, installments: 48, interestRate: 55, interestAnnual: true, interestTaxPct: 21 }));
  assert.ok(p.installment! > 400_000 && p.installment! < 450_000);
  assert.ok(p.totalInterest! > 0);
  near(p.totalToPay!, p.installment! * 48, 1);
  assert.equal(p.endPeriod, "2030-10");
});

test("previewLoan OPEN: con pago sugerido; sin él o inválido, todo null", () => {
  assert.deepEqual(previewLoan(input({ mode: "OPEN", installments: null, principal: 300, installmentAmount: 100 })), {
    installment: 100, totalToPay: 300, totalInterest: 0, endPeriod: "2027-01",
  });
  const none = { installment: null, totalToPay: null, totalInterest: null, endPeriod: null };
  assert.deepEqual(previewLoan(input({ mode: "OPEN", installments: null })), none);
  assert.deepEqual(previewLoan(input({ principal: 0 })), none);
  assert.deepEqual(previewLoan(input({ installments: 0 })), none);
  // el pago no cubre el interés: nunca termina
  assert.equal(previewLoan(input({ mode: "OPEN", installments: null, interestRate: 10, installmentAmount: 50 })).endPeriod, null);
});

// ── Mock: números derivados ──
test("mock: deudas del mes (hoy 2026-11-03)", async () => {
  const ov = await mockSource.getDebts();
  const rows = Object.fromEntries(ov.loans.map((l) => [l.id, loanRow(l, ov.period, ov.usdRate)]));
  assert.equal(rows["l-galicia"].capital, 4_820_000);
  assert.equal(rows["l-galicia"].installmentNumber, 5);
  assert.equal(rows["l-galicia"].monthPayment?.dueDate, "2026-11-05");
  assert.equal(rows["l-galicia"].monthPayment?.isDone, false);
  assert.equal(rows["l-papa"].capital, 300_000);
  assert.equal(rows["l-papa"].monthPayment?.amount, 50_000);
  assert.equal(rows["l-juan"].capital, 200_000);
  assert.equal(rows["l-martina"].capitalArs, 435_000);
  assert.deepEqual(ov.cards, { count: 3, debtArs: 721_050, nextDue: "2026-11-07" });
  const t = debtsTotals(ov);
  assert.equal(t.oweArs, 4_820_000 + 300_000 + 721_050);
  assert.equal(t.owedArs, 635_000);
  assert.equal(t.monthToPayArs, 412_000 + 50_000 + 721_050);
  assert.equal(t.monthToCollectArs, 100_000);
});

test("mock: patrimonio derivado de préstamos y tarjetas", async () => {
  const w = await mockSource.getWealth();
  const totals = wealthTotals(w.items, w.usdRate);
  assert.equal(totals.assets, 8_845_000);
  assert.equal(totals.debts, 5_841_050);
  assert.equal(totals.net, 3_003_950);
  assert.equal(w.history[w.history.length - 1].netArs, totals.net);
  const galicia = w.items.find((i) => i.id === "loan-l-galicia")!;
  assert.equal(galicia.amount, 4_820_000);
  assert.equal(galicia.source, "loan");
  assert.equal(w.items.find((i) => i.id === "cards")!.amount, 721_050);
  const owed = w.items.filter((i) => i.source === "loan" && i.kind === "asset");
  assert.equal(owed.length, 2);
  assert.ok(owed.every((i) => i.name.startsWith("Me deben: ")));
  const stage = nestStage(equityRatio(totals.assets, totals.debts));
  assert.equal(stage.chapter, 2);
  near(stage.progress, 0.807, 0.005);
  assert.equal((await mockSource.getHome()).story.chapter, 2);
});

test("mock: markLoanPaid y addLoan mueven los números", async () => {
  await mockSource.markLoanPaid("l-galicia", "2026-11");
  await mockSource.markLoanPaid("l-papa", "2026-11"); // la crea con la cuota propuesta
  let ov = await mockSource.getDebts();
  const papa = loanRow(ov.loans.find((l) => l.id === "l-papa")!, ov.period, ov.usdRate);
  assert.equal(papa.capital, 250_000);
  assert.equal(papa.monthPayment?.isDone, true);
  const gal = loanRow(ov.loans.find((l) => l.id === "l-galicia")!, ov.period, ov.usdRate);
  assert.equal(gal.monthPayment?.isDone, true);
  assert.equal(gal.capital, 4_820_000 + 267_310 - 412_000);
  assert.equal(debtsTotals(ov).monthToPayArs, 721_050);

  const before = (await mockSource.getWealth()).items.length;
  const created = await mockSource.addLoan(input({ name: "Nuevo", principal: 1_000_000, installments: 10, startPeriod: "2026-12" }));
  assert.ok(created.id);
  assert.equal(created.installmentAmount, 100_000);
  ov = await mockSource.getDebts();
  assert.equal(ov.loans.length, 5);
  assert.equal((await mockSource.getWealth()).items.length, before + 1);
});
