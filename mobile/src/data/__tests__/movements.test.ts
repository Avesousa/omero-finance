import test from "node:test";
import assert from "node:assert/strict";
import { movementsView } from "../movements.ts";
import { mockSource } from "../sources/mock.ts";

test("Movimientos muestra realizados y omite pendientes y propuestas", async () => {
  const plan = await mockSource.getPlan();
  const view = movementsView(plan);
  const items = [...view.days.flatMap((d) => d.items), ...(view.undated?.items ?? [])];
  assert.ok(items.length > 0);
  assert.ok(items.every((m) => !m.projected && (m.isDone || !m.hasStatus)));
  assert.equal(view.overdue, null);
  assert.equal(movementsView({ ...plan, entries: [], statements: [], started: false }).count, 0);
});

test("Solo Gastos avisa vencidos sin incluirlos en los totales ni el historial", async () => {
  const plan = await mockSource.getPlan();
  const entry = { ...plan.entries[0], id: "cuota", kind: "EXPENSE" as const, loanId: "loan", recurringId: null, date: "2026-11-01", isDone: false, amount: 100 };
  const source = { ...plan, today: "2026-11-04", entries: [entry], statements: [] };
  const view = movementsView(source, { kind: "expense" });
  assert.equal(view.overdue?.items[0].id, "cuota");
  assert.equal(view.count, 0);
  assert.equal(view.totals.expenses, 0);
  assert.equal(movementsView(source).overdue, null);
  assert.equal(movementsView(source, { kind: "income" }).overdue, null);
  assert.equal(movementsView({ ...source, today: "2026-11-01" }, { kind: "expense" }).overdue, null);
  const paid = movementsView({ ...source, entries: [{ ...entry, isDone: true }] }, { kind: "expense" });
  assert.equal(paid.overdue, null);
  assert.equal(paid.count, 1);
  assert.equal(paid.totals.expenses, 100);
});

test("Pago de tarjeta aparece una vez; sin fecha de pago no inventa vencimiento como pago", async () => {
  const plan = await mockSource.getPlan();
  const statement = { id: "st", cardId: plan.cards[0].id, period: plan.period, dueDate: "2026-11-01", totalArs: 100, minimumArs: null, usdAmount: null, payMode: "TOTAL" as const, customAmount: null, isPaid: true, paidAt: null };
  const source = { ...plan, entries: [], statements: [statement] };
  const view = movementsView(source);
  assert.equal(view.count, 1);
  assert.equal(view.undated?.items[0].statement, true);
  assert.equal(view.totals.expenses, 100);
  const dated = movementsView({ ...source, statements: [{ ...statement, paidAt: "2026-11-03T12:00:00Z" }] });
  assert.equal(dated.days[0].date, "2026-11-03");
  assert.equal(movementsView(source, { kind: "income" }).count, 0);
  assert.equal(movementsView(source, { query: "zzzzz" }).count, 0);
});


test("Fecha del pago de tarjeta usa Buenos Aires, no el día UTC", async () => {
  const plan = await mockSource.getPlan();
  const view = movementsView({ ...plan, entries: [], statements: [{ id: "st", cardId: plan.cards[0].id, period: plan.period, dueDate: null, totalArs: 100, minimumArs: null, usdAmount: null, payMode: "TOTAL", customAmount: null, isPaid: true, paidAt: "2026-11-04T01:00:00Z" }] });
  assert.equal(view.days[0].date, "2026-11-03");
});

test("Filtros suman el historial completo y búsqueda ignora tildes", async () => {
  const plan = await mockSource.getPlan();
  const all = movementsView(plan);
  const income = movementsView(plan, { kind: "income" });
  const expense = movementsView(plan, { kind: "expense" });
  assert.equal(income.count + expense.count, all.count);
  assert.equal(all.totals.expenses, expense.totals.expenses);
  assert.equal(all.totals.income, income.totals.income);
  const entry = { ...plan.entries[0], id: "search", recurringId: null, loanId: null, name: "Café", isDone: true };
  assert.equal(movementsView({ ...plan, entries: [entry], statements: [] }, { query: "CAFE" }).count, 1);
});


test("Fijo sin fecha de entrada usa su vencimiento configurado para el aviso", async () => {
  const plan = await mockSource.getPlan();
  const rule = { ...plan.recurrings[0], id: "fixed", dueDay: 2, frequency: "MONTHLY" as const };
  const entry = { ...plan.entries[0], id: "fixed-entry", kind: "EXPENSE" as const, recurringId: rule.id, loanId: null, date: null, isDone: false };
  const source = { ...plan, today: "2026-11-04", entries: [entry], recurrings: [rule], statements: [] };
  const view = movementsView(source, { kind: "expense" });
  assert.equal(view.overdue?.items[0].date, "2026-11-02");
  assert.equal(view.count, 0);
});

test("Sueldo confirmado se agrupa por fecha de cobro sin alterar su vencimiento", async () => {
  const plan = await mockSource.getPlan();
  const salary = { ...plan.entries[0], id: "salary", kind: "INCOME" as const, recurringId: "salary-rule", loanId: null, isDone: true, date: "2026-11-01", collectedAt: "2026-11-03" };
  const view = movementsView({ ...plan, entries: [salary], statements: [] }, { kind: "income" });
  assert.equal(view.count, 1);
  assert.equal(view.days[0].date, "2026-11-03");
  assert.equal(salary.date, "2026-11-01");
});

test("Confirmar ingresos lista sueldos existentes sin propuestas ni duplicar los cobrados", async () => {
  const { pendingIncomes } = await import("../movements.ts");
  const plan = await mockSource.getPlan();
  const salary = { ...plan.entries[0], id: "salary", kind: "INCOME" as const, recurringId: "salary-rule", loanId: null, isDone: false };
  const source = { ...plan, entries: [salary, { ...salary, id: "paid", isDone: true }, { ...salary, id: "proj-salary" }, { ...salary, id: "proposal-salary" }, { ...salary, id: "loan", loanId: "loan" }, { ...salary, id: "expense", kind: "EXPENSE" as const }], statements: [] };
  assert.deepEqual(pendingIncomes(source).map((e) => e.id), ["salary"]);
  assert.equal(movementsView(source, { kind: "income" }).count, 1);
});

test("Crear y confirmar un ingreso recurrente en mock conserva el mismo registro", async () => {
  const plan = await mockSource.getPlan();
  const input = { kind: "INCOME" as const, period: plan.period, name: "Sueldo por confirmar", amount: 100, currency: "ARS" as const, categoryId: null, date: null, note: null, fixed: { frequency: "MONTHLY" as const }, isDone: false, collectedAt: null };
  await mockSource.addEntry(input);
  const before = await mockSource.getPlan();
  const entry = before.entries.find((e) => e.name === input.name)!;
  assert.ok(entry.recurringId);
  assert.equal(entry.isDone, false);
  await mockSource.updateEntry(entry.id, { isDone: true, collectedAt: "2026-11-03" });
  const after = await mockSource.getPlan();
  assert.equal(after.entries.length, before.entries.length);
  assert.equal(after.entries.find((e) => e.id === entry.id)?.collectedAt, "2026-11-03");
  assert.equal(movementsView(after, { query: input.name }).count, 1);
  await mockSource.addEntry({ ...input, name: "Sueldo ya cobrado", isDone: true, collectedAt: "2026-11-04" });
  const created = await mockSource.getPlan();
  assert.equal(movementsView(created, { query: "Sueldo ya cobrado" }).count, 1);
});
