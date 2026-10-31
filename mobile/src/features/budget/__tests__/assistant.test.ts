import test from "node:test";
import assert from "node:assert/strict";
import { assistantReducer as reduce, initialAssistant, proposalOf, type AssistantAction, type AssistantState } from "../assistant/reducer.ts";
import type { AssistantLineMessage, AssistantSummaryMessage, AssistantTarget } from "../assistant/types.ts";

const savings: AssistantTarget = { categoryId: "ahorro", name: "Ahorro e inversión", kind: "savings", previous: 400_000, spentNow: 0, current: 400_000 };
const super_: AssistantTarget = { categoryId: "super", name: "Supermercado", kind: "category", previous: 420_000, spentNow: 180_000, current: 450_000 };
const ocio: AssistantTarget = { categoryId: "ocio", name: "Salidas y ocio", kind: "category", previous: null, spentNow: 45_000, current: 0 };
const nuevo: AssistantTarget = { categoryId: "nuevo", name: "Educación", kind: "category", previous: null, spentNow: 0, current: 0 };
const extra: AssistantTarget = { categoryId: "otros", name: "Otros", kind: "category", previous: null, spentNow: 0, current: 0 };

const run = (actions: AssistantAction[], from: AssistantState = initialAssistant) => actions.reduce(reduce, from);
const start = (steps: AssistantTarget[], extras: AssistantTarget[] = []): AssistantAction => ({ type: "start", at: 1, steps, extras });
const choose = (choice: "same" | "change" | "skip", id = "u"): AssistantAction => ({ type: "choose", at: 2, id, choice });
const text = (t: string, id = "t"): AssistantAction => ({ type: "text", at: 2, id, text: t });
const moments = (s: AssistantState) => s.messages.filter((m): m is AssistantLineMessage => m.kind === "mascot.line").map((m) => m.moment);
const last = (s: AssistantState) => s.messages.at(-1);

test("start: intro + primera pregunta (ahorro con dato previo) y es idempotente", () => {
  const s = run([start([savings, super_])]);
  assert.deepEqual(moments(s), ["budgetAssistIntro", "budgetAssistSavings"]);
  assert.equal(s.phase, "ask");
  assert.equal(s.current?.categoryId, "ahorro");
  assert.deepEqual((last(s) as AssistantLineMessage).vars, { name: "Ahorro e inversión", amount: 400_000 });
  assert.equal(reduce(s, start([ocio])), s);
});

test("el ahorro sin dato previo pregunta cuánto", () => {
  const s = run([start([{ ...savings, previous: null, current: 0 }])]);
  assert.deepEqual(moments(s), ["budgetAssistIntro", "budgetAssistSavingsNew"]);
});

test("proposalOf: mes anterior, si no lo gastado, si no nada", () => {
  assert.deepEqual(proposalOf(super_), { amount: 420_000, source: "previous" });
  assert.deepEqual(proposalOf(ocio), { amount: 45_000, source: "spent" });
  assert.equal(proposalOf(nuevo), null);
});

test("Igual: guarda la propuesta y pasa a la siguiente (con dato previo cita el monto)", () => {
  const s = run([start([savings, super_]), choose("same")]);
  assert.deepEqual(s.lines, [{ categoryId: "ahorro", name: "Ahorro e inversión", amount: 400_000 }]);
  assert.equal(s.current?.categoryId, "super");
  assert.equal(moments(s).at(-1), "budgetAssistCategory");
  const u = s.messages.find((m) => m.kind === "user.choice");
  assert.deepEqual(u && u.kind === "user.choice" && [u.choice, u.amount], ["same", 400_000]);
});

test("Igual con lo gastado cuando no hay mes anterior; pregunta con la frase 'New'", () => {
  const s = run([start([ocio]), choose("same")]);
  assert.equal(moments(s)[1], "budgetAssistCategoryNew");
  assert.deepEqual(s.lines.map((l) => l.amount), [45_000]);
});

test("Igual sin propuesta no hace nada", () => {
  const s = run([start([nuevo])]);
  assert.equal(reduce(s, choose("same")), s);
});

test("Cambiar pide el monto y se responde escribiendo ('300 mil')", () => {
  let s = run([start([super_]), choose("change")]);
  assert.equal(s.phase, "amount");
  assert.equal(moments(s).at(-1), "budgetAssistAskAmount");
  s = run([text("300 mil")], s);
  assert.deepEqual(s.lines, [{ categoryId: "super", name: "Supermercado", amount: 300_000 }]);
  assert.equal(s.phase, "summary");
  assert.equal(last(s)?.kind, "mascot.summary");
});

test("'1,5 palos' y escribir directo sin tocar Cambiar también valen", () => {
  assert.equal(run([start([super_]), text("1,5 palos")]).lines[0].amount, 1_500_000);
  assert.equal(run([start([super_]), choose("change"), text("$ 450.000")]).lines[0].amount, 450_000);
});

test("texto sin monto: vuelve a pedirlo y sigue esperando", () => {
  const s = run([start([super_]), text("no sé")]);
  assert.equal(s.phase, "amount");
  assert.equal(moments(s).at(-1), "budgetAssistAskAmount");
  assert.equal(s.lines.length, 0);
  assert.equal(s.current?.categoryId, "super");
  assert.equal(run([text("tampoco")], s).messages.filter((m) => m.kind === "mascot.line" && m.moment === "budgetAssistAskAmount").length, 2);
});

test("Saltar no agrega línea y avanza", () => {
  const s = run([start([savings, super_]), choose("skip"), choose("same")]);
  assert.deepEqual(s.lines.map((l) => l.categoryId), ["super"]);
});

test("Saltar mientras espera el monto vale; Igual y Cambiar no", () => {
  const waiting = run([start([super_, ocio]), choose("change")]);
  assert.equal(reduce(waiting, choose("same")), waiting);
  assert.equal(reduce(waiting, choose("change")), waiting);
  const s = reduce(waiting, choose("skip"));
  assert.equal(s.current?.categoryId, "ocio");
  assert.equal(s.lines.length, 0);
});

test("al terminar las categorías con extras pregunta si agregamos otra; elegir una la pregunta y vuelve", () => {
  let s = run([start([savings], [nuevo, extra]), choose("same")]);
  assert.equal(s.phase, "more");
  assert.equal(moments(s).at(-1), "budgetAssistMore");
  s = run([{ type: "pickExtra", at: 3, id: "p", categoryId: "nuevo" }], s);
  assert.equal(s.phase, "ask");
  assert.equal(moments(s).at(-1), "budgetAssistCategoryNew");
  assert.deepEqual(s.extras.map((e) => e.categoryId), ["otros"]);
  s = run([text("80 mil")], s);
  assert.equal(s.phase, "more");
  assert.deepEqual(s.lines.map((l) => [l.categoryId, l.amount]), [["ahorro", 400_000], ["nuevo", 80_000]]);
});

test("'No, listo' lleva al resumen con las líneas decididas", () => {
  const s = run([start([savings], [extra]), choose("same"), { type: "noMore", at: 3, id: "d" }]);
  assert.equal(s.phase, "summary");
  const summary = last(s) as AssistantSummaryMessage;
  assert.equal(summary.kind, "mascot.summary");
  assert.deepEqual(summary.lines, [{ categoryId: "ahorro", name: "Ahorro e inversión", amount: 400_000 }]);
});

test("sin extras, tras la última categoría va directo al resumen; sin pasos arranca en 'más' o resumen", () => {
  assert.equal(run([start([savings]), choose("same")]).phase, "summary");
  assert.equal(run([start([], [extra])]).phase, "more");
  assert.equal(run([start([], [])]).phase, "summary");
});

test("repetir una categoría reemplaza su línea", () => {
  const s = run([start([super_], [extra]), choose("same"), { type: "pickExtra", at: 3, id: "p", categoryId: "otros" }, text("50 mil")]);
  assert.deepEqual(s.lines.map((l) => l.amount), [420_000, 50_000]);
});

test("confirmar → guardando → listo con budgetAssistDone y el sin asignar", () => {
  let s = run([start([savings]), choose("same"), { type: "confirm", at: 4, id: "c" }]);
  assert.equal(s.phase, "saving");
  s = run([{ type: "saved", at: 5, free: 123_000 }], s);
  assert.equal(s.phase, "saved");
  assert.equal(moments(s).at(-1), "budgetAssistDone");
  assert.deepEqual((last(s) as AssistantLineMessage).vars, { amount: 123_000 });
});

test("si falla el guardado vuelve al resumen con error y se puede reintentar", () => {
  let s = run([start([savings]), choose("same"), { type: "confirm", at: 4, id: "c" }, { type: "saveFailed", at: 5 }]);
  assert.equal(s.phase, "summary");
  assert.equal(s.error, true);
  s = run([{ type: "confirm", at: 6, id: "c2" }], s);
  assert.equal(s.phase, "saving");
  assert.equal(s.error, false);
});

test("sin líneas no se puede confirmar; fuera de fase las acciones se ignoran", () => {
  const empty = run([start([savings]), choose("skip")]);
  assert.equal(empty.phase, "summary");
  assert.equal(reduce(empty, { type: "confirm", at: 9, id: "c" }), empty);
  assert.equal(reduce(empty, text("100 mil")), empty);
  assert.equal(reduce(empty, choose("same")), empty);
  assert.equal(reduce(initialAssistant, { type: "saved", at: 1, free: 0 }), initialAssistant);
});

test("reset vuelve al inicio", () => {
  assert.equal(run([start([savings]), { type: "reset" }]), initialAssistant);
});
