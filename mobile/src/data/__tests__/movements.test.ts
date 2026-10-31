import test from "node:test";
import assert from "node:assert/strict";
import { movementsView, normalizeSearch } from "../movements.ts";
import { homeFromPlan } from "../plan.ts";
import { mockSource } from "../sources/mock.ts";

const extras = { greetingName: "Avelino", pendingConfirmCount: 0, story: { chapter: 1, progress: 0 } };

test("movementsView todos: días pasados desc, Próximos asc, Sin fecha al final", async () => {
  const plan = await mockSource.getPlan();
  const v = movementsView(plan);
  assert.equal(v.count, v.totalCount);
  const dates = v.days.map((d) => d.date);
  assert.deepEqual(dates, [...dates].sort().reverse());
  // Los fijos sin pagar con vencimiento futuro van a Próximos, ordenados por fecha ascendente.
  const up = v.upcoming!.items;
  assert.ok(up.length > 0);
  assert.ok(up.every((m) => m.date! > v.today && !m.isDone));
  const upDates = up.map((m) => m.date!);
  assert.deepEqual(upDates, [...upDates].sort());
  assert.ok(up.some((m) => m.name === "Prepaga") && up[0].date! <= "2026-11-08");
  // Ningún día pasado contiene algo futuro sin pagar.
  assert.ok(v.days.flatMap((d) => d.items).every((m) => !(m.date! > v.today && !m.isDone)));
  const n = v.days.reduce((acc, d) => acc + d.items.length, 0) + up.length + (v.undated?.items.length ?? 0);
  assert.equal(n, v.count);
  // Dentro del día, el ingreso va primero.
  assert.equal(v.days.find((d) => d.date === "2026-11-01")!.items[0].kind, "INCOME");
});

test("movementsView: un fijo futuro ya pagado queda en su día, no en Próximos", async () => {
  await mockSource.updateEntry("e-expensas", { isDone: true });
  const v = movementsView(await mockSource.getPlan());
  assert.ok(!v.upcoming!.items.some((m) => m.name === "Expensas"));
  assert.ok(v.days.find((d) => d.date === "2026-11-10")!.items.some((m) => m.name === "Expensas"));
  await mockSource.updateEntry("e-expensas", { isDone: false });
});

test("movementsView: filtro por tipo y totales coherentes con Inicio", async () => {
  const plan = await mockSource.getPlan();
  const all = movementsView(plan);
  const inc = movementsView(plan, { kind: "income" });
  const exp = movementsView(plan, { kind: "expense" });
  assert.ok(inc.days.flatMap((d) => d.items).every((m) => m.kind === "INCOME"));
  assert.ok(exp.days.flatMap((d) => d.items).every((m) => m.kind === "EXPENSE"));
  assert.equal(inc.count + exp.count, all.count);
  assert.equal(inc.totals.income, 3_500_000);
  assert.equal(inc.totals.expenses, 0);
  assert.equal(all.totals.balance, all.totals.income - all.totals.expenses);
  assert.equal(inc.totalCount, all.totalCount);
  assert.equal(homeFromPlan(plan, extras).income, all.totals.income);
});

test("movementsView: búsqueda sin tildes ni mayúsculas, por nombre y categoría", async () => {
  const plan = await mockSource.getPlan();
  assert.equal(normalizeSearch("  Súper "), "super");
  const byName = movementsView(plan, { query: "SUPERMERCADO" });
  assert.equal(byName.count, 1);
  assert.equal(byName.days[0].items[0].name, "Supermercado");
  const byCategory = movementsView(plan, { query: "servicios" });
  const flat = (v: ReturnType<typeof movementsView>) => [...v.days.flatMap((d) => d.items), ...(v.upcoming?.items ?? [])];
  assert.deepEqual(flat(byCategory).map((m) => m.name).sort(), ["Gas", "Internet", "Luz"]);
  const none = movementsView(plan, { query: "zzz" });
  assert.equal(none.count, 0);
  assert.equal(none.days.length, 0);
  assert.equal(none.upcoming, null);
  assert.equal(none.totalCount, byName.totalCount);
});

test("movementsView: fijos y cuotas llevan estado; los demás no", async () => {
  const plan = await mockSource.getPlan();
  const all = movementsView(plan);
  const items = [...all.days.flatMap((d) => d.items), ...(all.upcoming?.items ?? [])];
  const alquiler = items.find((m) => m.name === "Alquiler")!;
  assert.equal(alquiler.fixed, true);
  assert.equal(alquiler.hasStatus, true);
  const sup = items.find((m) => m.name === "Supermercado")!;
  assert.equal(sup.hasStatus, false);
  assert.equal(sup.fixed, false);
  assert.ok(items.filter((m) => m.installment).every((m) => m.hasStatus && !m.fixed));
});

test("movementsView mes que no empezó: propuestas sin abrir", async () => {
  const v = movementsView(await mockSource.getPlan("2026-12"));
  assert.ok(v.count > 0);
  const items = [...v.days.flatMap((d) => d.items), ...(v.upcoming?.items ?? []), ...(v.undated?.items ?? [])];
  assert.ok(items.every((m) => m.projected && !m.isDone));
});

test("updateEntry con fecha mueve el movimiento de día", async () => {
  await mockSource.updateEntry("e-compras", { date: "2026-11-09" });
  const v = movementsView(await mockSource.getPlan());
  assert.ok(v.days.find((d) => d.date === "2026-11-09")?.items.some((m) => m.name === "Compras") || v.upcoming!.items.some((m) => m.name === "Compras"));
  await mockSource.updateEntry("e-compras", { date: null });
  assert.ok(movementsView(await mockSource.getPlan()).undated!.items.some((m) => m.name === "Compras"));
});
