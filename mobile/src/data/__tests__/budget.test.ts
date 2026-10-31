import test from "node:test";
import assert from "node:assert/strict";
import { assistantTargets, budgetAllocation, budgetNotices, budgetView, categoryColorOrder, previousBudgetItems, projectedFree, suggestedBudget, withBudgetItems } from "../budget.ts";
import { homeDefinitions, homeFromPlan, projectedPlan } from "../plan.ts";
import { mockSource } from "../sources/mock.ts";
import { parseSpokenAmount } from "../../domain/index.ts";
import type { MonthPlan } from "../../domain/index.ts";

// Estos tests corren sobre copias del plan (`getPlan` devuelve clones) para no depender del orden con los demás archivos.
const extras = { greetingName: "Avelino", pendingConfirmCount: 0, story: { chapter: 1, progress: 0 } };
const load = (period?: string): Promise<MonthPlan> => mockSource.getPlan(period);

test("mock noviembre: Inicio sale del plan (ingresos, disponible, libre, por día, fijos)", async () => {
  const h = homeFromPlan(await load(), extras);
  assert.equal(h.income, 3_500_000);
  assert.equal(h.available, 2_618_000);
  assert.equal(h.free, 170_325);
  assert.equal(h.pendingToPay, 1_572_675);
  assert.equal(h.daysLeft, 28);
  assert.deepEqual(h.fixed, { paid: 3, total: 7, paidAmount: 607_000, totalAmount: 935_000 });
  // 5 tramos: 4 categorías + "Otros"; la suma conserva el total cargado (2.454.675).
  assert.equal(h.spendingByCategory.length, 5);
  assert.equal(h.spendingByCategory[0].name, "Tarjetas de crédito");
  assert.equal(h.spendingByCategory[4].id, "other");
  assert.equal(h.spendingByCategory.reduce((s, c) => s + c.amount, 0), 2_454_675);
});

test("libre = ingresos − Σ máx(tope, cargado) por categoría", async () => {
  const plan = await load();
  const v = budgetView(plan);
  const byCat = new Map(plan.categories.map((c) => [c.id, 0]));
  for (const r of v.summary.rows) if (r.categoryId) byCat.set(r.categoryId, Math.max(r.budget, r.actual));
  const sum = [...byCat.values()].reduce((s, n) => s + n, 0);
  assert.equal(v.free, v.income - sum);
});

test("budgetView noviembre: grupos, asignado y contadores", async () => {
  const v = budgetView(await load());
  assert.equal(v.income, 3_500_000);
  assert.equal(v.free, 170_325);
  assert.equal(v.assigned, 1_150_000);
  assert.equal(v.savings?.name, "Ahorro e inversión");
  assert.equal(v.savings?.budget, 400_000);
  assert.equal(v.savings?.actual, 0);
  assert.deepEqual(v.committed.map((l) => l.name), ["Alquiler", "Expensas", "Servicios", "Salud", "Suscripciones", "Deudas y préstamos", "Tarjetas de crédito"]);
  assert.deepEqual(v.variable.map((l) => l.name), ["Supermercado", "Transporte", "Salidas y ocio", "Compras", "Otros"]);
  assert.ok(v.committed.every((l) => l.group === "committed" && l.fixed));
  assert.deepEqual(v.committed.find((l) => l.name === "Servicios")?.fixed, { paid: 2, total: 3 });
  assert.deepEqual(v.committed.find((l) => l.name === "Deudas y préstamos")?.fixed, { paid: 0, total: 2 });
  assert.deepEqual(v.committed.find((l) => l.name === "Tarjetas de crédito")?.fixed, { paid: 0, total: 3 });
  assert.ok(v.variable.every((l) => l.group === "variable" && l.fixed === null));
  assert.deepEqual(v.counts, { near: 0, over: 0 });
  assert.deepEqual(v.variableTotals, { budget: 750_000, actual: 275_000 });
  assert.equal(v.canCopyPrevious, false);
  assert.deepEqual(v.withoutBudget.map((c) => c.name), ["Educación", "Familia"]);
});

test("budgetView diciembre: sin presupuesto, se puede copiar noviembre", async () => {
  const plan = await load("2026-12");
  const v = budgetView(plan);
  assert.equal(plan.started, false);
  assert.equal(v.assigned, 0);
  assert.equal(v.canCopyPrevious, true);
  assert.equal(v.previousPeriod, "2026-11");
  assert.equal(v.savings?.budget, 0);
  assert.equal(v.savings?.status, "unused");
  assert.equal(previousBudgetItems(plan).length, 6);
});

test("saveBudget: guarda, quita con 0 y se refleja en el plan; copiar deja diciembre igual a noviembre", async () => {
  await mockSource.saveBudget("2026-12", previousBudgetItems(await load("2026-12")));
  let v = budgetView(await load("2026-12"));
  assert.equal(v.assigned, 1_150_000);
  assert.equal(v.canCopyPrevious, false);
  await mockSource.saveBudget("2026-12", [{ categoryId: "exp-otros", amount: 0 }, { categoryId: "exp-compras", amount: 90_000 }]);
  v = budgetView(await load("2026-12"));
  assert.equal(v.assigned, 1_150_000 - 40_000 - 60_000 + 90_000);
  assert.equal(v.variable.find((l) => l.name === "Otros"), undefined);
});

test("cerca y pasado del tope: estado, contadores y avisos", async () => {
  const plan = await load();
  plan.budgets = plan.budgets.map((b) =>
    b.categoryId === "exp-salidas" ? { ...b, amount: 50_000 } // 45.000 de 50.000 = 90 % → cerca
    : b.categoryId === "exp-compras" ? { ...b, amount: 15_000 } // 20.000 de 15.000 → pasado
    : b,
  );
  const v = budgetView(plan);
  assert.equal(v.variable.find((l) => l.name === "Salidas y ocio")?.status, "near");
  assert.equal(v.variable.find((l) => l.name === "Compras")?.status, "over");
  assert.deepEqual(v.counts, { near: 1, over: 1 });
  const notices = budgetNotices(v, plan.today);
  assert.deepEqual(notices.map((n) => [n.kind, n.params.name]), [["budgetNear", "Salidas y ocio"], ["budgetOverCategory", "Compras"]]);
});

test("el ahorro nunca cuenta como cerca o pasado", async () => {
  const plan = await load();
  plan.entries.push({ ...plan.entries[0], id: "x", kind: "EXPENSE", recurringId: null, categoryId: "exp-ahorro", amount: 500_000, name: "Ahorro" });
  const v = budgetView(plan);
  assert.equal(v.savings?.status, "over");
  assert.deepEqual(v.counts, { near: 0, over: 0 });
});

test("suggestedBudget: tope del mes anterior y lo gastado ahora", async () => {
  const plan = await load();
  assert.deepEqual(suggestedBudget(plan, "exp-supermercado"), { previous: 420_000, spentNow: 180_000 });
  assert.deepEqual(suggestedBudget(plan, "exp-servicios"), { previous: null, spentNow: 85_000 });
  assert.deepEqual(suggestedBudget(plan, "exp-educacion"), { previous: null, spentNow: 0 });
});

test("notificaciones del mock: sin topes cerca no hay avisos de presupuesto", async () => {
  const n = await mockSource.getNotifications();
  assert.ok(!n.notices.some((x) => x.kind === "budgetNear" || x.kind === "budgetOverCategory"));
});

test("parser de montos compartido: lo que escribe el usuario en el asistente", () => {
  assert.equal(parseSpokenAmount("300 mil"), 300_000);
  assert.equal(parseSpokenAmount("1,5 palos"), 1_500_000);
  assert.equal(parseSpokenAmount("$ 450.000"), 450_000);
  assert.equal(parseSpokenAmount("nada"), null);
});

test("withBudgetItems / projectedFree: aplica sin mutar y el libre se mueve con el tope", async () => {
  const plan = await load();
  const before = budgetView(plan).free;
  const next = withBudgetItems(plan, [{ categoryId: "exp-ahorro", amount: 500_000 }, { categoryId: "exp-otros", amount: 0 }]);
  assert.equal(plan.budgets.find((b) => b.categoryId === "exp-ahorro")?.amount, 400_000);
  assert.equal(next.budgets.find((b) => b.categoryId === "exp-ahorro")?.amount, 500_000);
  assert.ok(!next.budgets.some((b) => b.categoryId === "exp-otros"));
  assert.equal(projectedFree(plan, []), before);
  assert.equal(projectedFree(plan, [{ categoryId: "exp-ahorro", amount: 500_000 }]), before - 100_000);
});

test("assistantTargets: ahorro primero, variables con dato y el resto como extras", async () => {
  const { steps, extras } = assistantTargets(await load());
  assert.equal(steps[0].kind, "savings");
  assert.equal(steps[0].name, "Ahorro e inversión");
  assert.deepEqual(steps[0], { categoryId: "exp-ahorro", name: "Ahorro e inversión", kind: "savings", previous: 400_000, spentNow: 0, current: 400_000 });
  const sup = steps.find((s) => s.categoryId === "exp-supermercado");
  assert.deepEqual([sup?.previous, sup?.spentNow, sup?.current], [420_000, 180_000, 450_000]);
  assert.ok(steps.slice(1).every((s) => s.kind === "category"));
  // lo comprometido no se pregunta
  assert.ok(![...steps, ...extras].some((s) => s.name === "Alquiler" || s.name === "Tarjetas de crédito"));
  assert.ok(extras.every((e) => e.previous === null && e.spentNow === 0 && e.current === 0));
  assert.ok(extras.some((e) => e.categoryId === "exp-educacion"));
});

test("assistantTargets diciembre: propone el tope de noviembre aunque diciembre no tenga presupuesto", async () => {
  const plan = await load("2026-12");
  plan.budgets = []; // el mock es estado en memoria: otro test pudo copiar noviembre
  const { steps } = assistantTargets(plan);
  assert.equal(steps[0].previous, 400_000);
  assert.equal(steps[0].current, 0);
});

test("projectedPlan: mes iniciado sin cambios", async () => {
  const plan = await load();
  assert.equal(plan.started, true);
  assert.equal(projectedPlan(plan), plan);
  assert.equal(budgetView(plan).projected, false);
});

test("projectedPlan: mes no iniciado proyecta ingresos, fijos y cuotas (sin pagar, idempotente)", async () => {
  const plan = await load("2026-12");
  const p = projectedPlan(plan);
  const added = p.entries.filter((e) => e.id.startsWith("proj-"));
  assert.ok(added.length > 0 && p.entries.length === plan.entries.length + added.length);
  assert.ok(added.every((e) => e.period === "2026-12" && !e.isDone));
  assert.ok(added.some((e) => e.kind === "INCOME" && e.recurringId));
  assert.ok(added.some((e) => e.kind === "EXPENSE" && e.recurringId));
  assert.ok(added.filter((e) => e.loanId).every((e) => e.interestAmount !== null));
  assert.equal(plan.entries.length, (await load("2026-12")).entries.length, "no muta el original");
  assert.equal(projectedPlan(p).entries.length, p.entries.length);
  const v = budgetView(plan);
  assert.equal(v.projected, true);
  assert.ok(v.income > 0);
  assert.ok(v.committed.length > 0);
});

test("diciembre: con el presupuesto de noviembre copiado el Sin asignar queda positivo", async () => {
  const plan = await load("2026-12");
  const before = budgetView(plan).free;
  const after = projectedFree(plan, previousBudgetItems(plan));
  assert.ok(after > 0);
});

test("definiciones de Inicio: balance, por día, libre del mes, ingresos y gastos del mes", async () => {
  const plan = await load();
  const h = homeFromPlan(plan, extras);
  const d = homeDefinitions(h);
  assert.equal(d.balance, 2_618_000);
  assert.equal(d.balance, h.available);
  assert.equal(d.freeMonth, 170_325);
  assert.equal(d.perDay, 6_083); // floor(170.325 / 28)
  assert.equal(d.monthIncome, 3_500_000);
  assert.equal(h.monthIncome, h.income);
  // Gastos = lo que ya salió = ingresos − balance.
  assert.equal(d.monthExpenses, 3_500_000 - 2_618_000);
});

test("definiciones de Inicio: sin libre o sin días el gasto diario es 0", () => {
  const base = { balance: 100, monthIncome: 500, monthExpenses: 400 };
  assert.equal(homeDefinitions({ ...base, free: -50, daysLeft: 10 }).perDay, 0);
  assert.equal(homeDefinitions({ ...base, free: 900, daysLeft: 0 }).perDay, 0);
  assert.equal(homeDefinitions({ ...base, free: 900, daysLeft: 0 }).freeMonth, 900);
});

test("categoryColorOrder: ahorro primero, solo gastos activos, igual en todos los meses", async () => {
  const nov = await load();
  const order = categoryColorOrder(nov);
  const names = order.map((id) => nov.categories.find((c) => c.id === id)?.name);
  assert.equal(names[0], "Ahorro e inversión");
  assert.ok(order.every((id) => nov.categories.find((c) => c.id === id)?.kind === "EXPENSE"));
  assert.equal(new Set(order).size, order.length);
  assert.deepEqual(categoryColorOrder(await load("2026-12")), order);
  // No cambia al editar un tope.
  assert.deepEqual(categoryColorOrder(withBudgetItems(nov, [{ categoryId: order[1], amount: 1 }])), order);
});

test("budgetAllocation: un tramo por categoría con tope o gasto, y el resto sin asignar", async () => {
  const v = budgetView(await load());
  const a = budgetAllocation(v);
  assert.equal(a.income, 3_500_000);
  assert.equal(a.free, 170_325);
  assert.equal(a.remainder, 170_325);
  assert.equal(a.items[0].name, "Ahorro e inversión");
  assert.ok(a.items.every((i) => i.value > 0));
  // Lo asignado + lo que queda = los ingresos.
  assert.equal(a.items.reduce((s, i) => s + i.value, 0) + a.remainder, a.income);
});

test("budgetAllocation: si asignaste de más no queda sin asignar y free es negativo", async () => {
  const plan = await load();
  const savingsId = budgetView(plan).savings!.categoryId!;
  const over = budgetAllocation(budgetView(withBudgetItems(plan, [{ categoryId: savingsId, amount: 5_000_000 }])));
  assert.ok(over.free < 0);
  assert.equal(over.remainder, 0);
});

test("budgetAllocation: con muchas categorías, las 5 de mayor monto + Otras (la suma del resto)", async () => {
  const v = budgetView(await load());
  const full = [...(v.savings ? [v.savings] : []), ...v.committed, ...v.variable].map((l) => ({ key: l.categoryId ?? "uncategorized", value: Math.max(l.budget, l.actual) })).filter((i) => i.value > 0);
  assert.ok(full.length > 6);
  const a = budgetAllocation(v);
  assert.equal(a.items.length, 6);
  const other = a.items[5];
  assert.equal(other.key, "__other");
  assert.equal(other.group, "other");
  const top5 = a.items.slice(0, 5);
  const expected = [...full].sort((x, y) => y.value - x.value).slice(0, 5).map((i) => i.key).sort();
  assert.deepEqual(top5.map((i) => i.key).sort(), expected);
  // Mismo orden relativo que la lista completa (no se recalcula el orden de colores).
  const order = full.map((i) => i.key).filter((k) => expected.includes(k));
  assert.deepEqual(top5.map((i) => i.key), order);
  assert.equal(other.value, full.filter((i) => !expected.includes(i.key)).reduce((s, i) => s + i.value, 0));
  assert.equal(a.items.reduce((s, i) => s + i.value, 0), full.reduce((s, i) => s + i.value, 0));
});
