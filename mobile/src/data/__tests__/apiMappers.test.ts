import { AppError, isMonthNotStarted, toAppError } from "../errors.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { cardsFromPlan, debtsFromPlan, manualWealthItems, wealthFromPlan } from "../sources/apiMappers.ts";
import { mockSource } from "../sources/mock.ts";
import type { BalanceItemDTO } from "../../domain/index.ts";

const balance: BalanceItemDTO[] = [
  { id: "b1", type: "ASSET", name: "Caja de ahorro", currency: "ARS", isArchived: false, values: { "2026-10": 1_000_000, "2026-11": 1_250_000 } },
  { id: "b2", type: "ASSET", name: "Dólares", currency: "USD", isArchived: false, values: { "2026-09": 3_000 } },
  { id: "b3", type: "DEBT", name: "Deuda vieja", currency: "ARS", isArchived: false, values: { "2026-11": 200_000 } },
  { id: "b4", type: "ASSET", name: "Cerrada", currency: "ARS", isArchived: true, values: { "2026-11": 9 } },
];

test("tarjetas: se traducen las del backend (marca, dueño, compras con nombre de categoría)", async () => {
  const plan = await mockSource.getPlan();
  const c = cardsFromPlan(plan);
  assert.equal(c.cards.length, plan.cards.length);
  assert.equal(c.statements.length, plan.statements.length);
  assert.equal(c.purchases.length, plan.purchases.length);
  assert.equal(c.period, plan.period);
  const withCat = plan.purchases.find((p) => p.categoryId);
  if (withCat) assert.ok(c.purchases.find((p) => p.id === withCat.id)?.categoryName);
});

test("deudas: préstamos del plan y deuda de tarjetas del período", async () => {
  const plan = await mockSource.getPlan();
  const d = debtsFromPlan(plan);
  assert.equal(d.loans.length, plan.loans.length);
  assert.equal(d.cards.count > 0, true);
});

test("patrimonio manual: saldo del mes, anterior para el delta, sin archivados; saldo anterior se arrastra", () => {
  const items = manualWealthItems(balance, "2026-11");
  assert.deepEqual(items.map((i) => i.id), ["b1", "b2", "b3"]);
  assert.equal(items[0].amount, 1_250_000);
  assert.equal(items[0].previous, 1_000_000);
  assert.equal(items[1].amount, 3_000); // sin dato en noviembre: el último conocido
  assert.equal(items[2].kind, "debt");
});

test("patrimonio: items manuales + derivados, historial sin meses vacíos y sin metas", async () => {
  const plan = await mockSource.getPlan();
  const w = wealthFromPlan(plan, balance);
  assert.ok(w.items.some((i) => i.source === "manual"));
  assert.ok(w.items.some((i) => i.source === "loan" || i.source === "card"));
  assert.deepEqual(w.goals, []);
  assert.equal(w.history.at(-1)?.period, plan.period);
  assert.ok(w.history.length >= 1 && w.history.length <= 6);
});

test("patrimonio sin nada cargado: queda el mes actual en 0", async () => {
  const plan = { ...(await mockSource.getPlan()), loans: [], statements: [], purchases: [], cards: [] };
  const w = wealthFromPlan(plan, []);
  assert.equal(w.items.length, 0);
  assert.deepEqual(w.history, [{ period: plan.period, netArs: 0 }]);
});

test("errores: 'Primero iniciá el mes' (409) se reconoce y el resto no", () => {
  const e = Object.assign(new Error("Primero iniciá el mes"), { status: 409 });
  assert.equal(toAppError(e).code, "month_not_started");
  assert.equal(isMonthNotStarted(e), true);
  assert.equal(isMonthNotStarted(Object.assign(new Error("Otro conflicto"), { status: 409 })), false);
  assert.equal(isMonthNotStarted(new AppError("x")), false);
});
