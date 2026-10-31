import test from "node:test";
import assert from "node:assert/strict";
import { fixedExpensesView } from "../fixed.ts";
import { homeFromPlan } from "../plan.ts";
import { mockSource } from "../sources/mock.ts";
import type { MonthPlan } from "../../domain/index.ts";

const extras = { greetingName: "Avelino", pendingConfirmCount: 0, story: { chapter: 1, progress: 0 } };
const load = (period?: string): Promise<MonthPlan> => mockSource.getPlan(period);
const find = (v: ReturnType<typeof fixedExpensesView>, name: string) => v.groups.flatMap((g) => g.items).find((i) => i.name === name)!;

test("fixedExpensesView noviembre: totales, orden y próximo vencimiento", async () => {
  const v = fixedExpensesView(await load());
  assert.equal(v.projected, false);
  assert.equal(v.total, 935_000);
  assert.equal(v.paid, 607_000);
  assert.equal(v.pending, 328_000);
  assert.equal(v.count, 7);
  assert.equal(v.paidCount, 3);
  assert.deepEqual(v.nextDue, { name: "Prepaga", date: "2026-11-08", days: 5 });
  const order = v.groups.flatMap((g) => g.items).map((i) => i.name);
  assert.deepEqual(order, ["Alquiler", "Prepaga", "Expensas", "Luz", "Gas", "Internet", "Suscripciones"]);
  const servicios = v.groups.find((g) => g.categoryId === "exp-servicios")!;
  assert.equal(servicios.name, "Servicios");
  assert.equal(servicios.total, 85_000);
  assert.equal(servicios.items.length, 3);
  // Coincide con el bloque `fixed` de Inicio.
  const h = homeFromPlan(await load(), extras);
  assert.deepEqual({ paid: v.paidCount, total: v.count, paidAmount: v.paid, totalAmount: v.total }, h.fixed);
});

test("fixedExpensesView diciembre: proyectado, solo lectura, sin entryId", async () => {
  const v = fixedExpensesView(await load("2026-12"));
  assert.equal(v.projected, true);
  assert.equal(v.count, 7);
  assert.equal(v.total, 935_000);
  assert.equal(v.paid, 0);
  assert.ok(v.groups.flatMap((g) => g.items).every((i) => i.entryId === null && !i.isDone));
});

test("updateEntry: aplicar a la regla cambia categoría, día y recalcula; sin applyToRule solo este mes", async () => {
  await mockSource.updateEntry("e-gas", { categoryId: "exp-otros", amount: 24_000 });
  let plan = await load();
  assert.equal(plan.recurrings.find((r) => r.id === "r-gas")!.categoryId, "exp-servicios");
  assert.equal(find(fixedExpensesView(plan), "Gas").categoryId, "exp-otros");

  await mockSource.updateEntry("e-gas", { categoryId: "exp-otros", amount: 24_000, applyToRule: true, dueDay: 20 });
  plan = await load();
  const rule = plan.recurrings.find((r) => r.id === "r-gas")!;
  assert.equal(rule.categoryId, "exp-otros");
  assert.equal(rule.amount, 24_000);
  assert.equal(rule.dueDay, 20);
  assert.equal(find(fixedExpensesView(plan), "Gas").dueDate, "2026-11-20");
  // Diciembre (proyectado) toma la regla nueva.
  assert.equal(find(fixedExpensesView(await load("2026-12")), "Gas").amount, 24_000);
  // Restaurar.
  await mockSource.updateEntry("e-gas", { categoryId: "exp-servicios", amount: 22_000, applyToRule: true, dueDay: 15 });
});

test("updateEntry: pasar a semanal multiplica por las veces del mes", async () => {
  await mockSource.addEntry({
    kind: "EXPENSE", period: "2026-11", name: "Pilates", amount: 10_000, currency: "ARS", categoryId: "exp-salud",
    date: null, note: null, fixed: { frequency: "WEEKLY", weekday: 1 },
  });
  const item = find(fixedExpensesView(await load()), "Pilates");
  assert.equal(item.frequency, "WEEKLY");
  assert.equal(item.unitAmount, 10_000);
  assert.equal(item.amount, 50_000); // 5 lunes en noviembre 2026
  assert.equal(item.dueDate, "2026-11-09"); // hoy es martes 3: el próximo lunes
  assert.equal(item.isDone, false);
  await mockSource.deleteEntry(item.entryId!, "rule");
});

test("deleteEntry: month saca solo el movimiento; rule además desactiva la regla", async () => {
  await mockSource.deleteEntry("e-internet", "month");
  let plan = await load();
  assert.equal(fixedExpensesView(plan).count, 6);
  assert.ok(plan.recurrings.find((r) => r.id === "r-internet")!.isActive);

  await mockSource.deleteEntry("e-suscripciones", "rule");
  plan = await load();
  assert.equal(fixedExpensesView(plan).count, 5);
  assert.equal(plan.recurrings.find((r) => r.id === "r-suscripciones")!.isActive, false);
  assert.equal(fixedExpensesView(await load("2026-12")).count, 6); // sin Suscripciones; Internet vuelve en diciembre
});
