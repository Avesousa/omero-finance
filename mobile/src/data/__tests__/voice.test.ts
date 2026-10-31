import test from "node:test";
import assert from "node:assert/strict";
import { mockInterpret, mockOutcome, parseSpokenAmount } from "../sources/mockVoice.ts";
import { mockSource } from "../sources/mock.ts";
import { AppError, toAppError } from "../errors.ts";
import type { VoiceContext } from "../../domain/index.ts";

const ctx: VoiceContext = {
  today: "2026-11-03",
  incomeCategories: [
    { id: "ic-sueldo", name: "Sueldo" },
    { id: "ic-freelance", name: "Freelance" },
    { id: "ic-alquileres", name: "Alquileres" },
    { id: "ic-otros", name: "Otros ingresos" },
  ],
  expenseCategories: [
    { id: "exp-supermercado", name: "Supermercado" },
    { id: "exp-transporte", name: "Transporte" },
    { id: "exp-salidas", name: "Salidas y ocio" },
    { id: "exp-servicios", name: "Servicios" },
    { id: "exp-otros", name: "Otros" },
  ],
};

test("parseSpokenAmount: dígitos, escalas y palabras", () => {
  assert.equal(parseSpokenAmount("cobré 45 mil"), 45_000);
  assert.equal(parseSpokenAmount("me pagaron 1,5 millones"), 1_500_000);
  assert.equal(parseSpokenAmount("un palo"), 1_000_000);
  assert.equal(parseSpokenAmount("$ 45.000"), 45_000);
  assert.equal(parseSpokenAmount("USD 300"), 300);
  assert.equal(parseSpokenAmount("1.200.000,50"), 1_200_000.5);
  assert.equal(parseSpokenAmount("un millón doscientos mil"), 1_200_000);
  assert.equal(parseSpokenAmount("quinientos mil"), 500_000);
  assert.equal(parseSpokenAmount("treinta y cinco mil"), 35_000);
  assert.equal(parseSpokenAmount("dos millones y medio"), 2_000_000);
  assert.equal(parseSpokenAmount("me llegó un ingreso"), null);
});

test("mockInterpret: ingreso con monto, moneda, categoría, fijo y fecha", () => {
  const e = mockInterpret("Me pagaron el sueldo, un millón doscientos mil", ctx);
  assert.equal(e.intent, "income");
  assert.equal(e.entry?.amount, 1_200_000);
  assert.equal(e.entry?.categoryName, "Sueldo");
  assert.equal(e.entry?.fixed, false);

  const usd = mockInterpret("Cobré 300 dólares de freelance ayer", ctx);
  assert.equal(usd.entry?.currency, "USD");
  assert.equal(usd.entry?.categoryName, "Freelance");
  assert.equal(usd.entry?.date, "2026-11-02");

  const fijo = mockInterpret("Me depositan alquiler, ingreso de 150 mil todos los meses", ctx);
  assert.equal(fijo.entry?.fixed, true);
  assert.equal(fijo.entry?.frequency, "MONTHLY");
  assert.equal(fijo.entry?.categoryName, "Alquileres");
});

test("mockInterpret: gasto con monto, categoría, fecha y fijo; tarjeta es card_purchase", () => {
  const sup = mockInterpret("gasté 5 mil en el súper", ctx);
  assert.equal(sup.intent, "expense");
  assert.equal(sup.entry?.amount, 5_000);
  assert.equal(sup.entry?.categoryName, "Supermercado");

  const nafta = mockOutcome("ayer pagué 30 mil de nafta", ctx);
  assert.equal(nafta.kind, "draft");
  if (nafta.kind === "draft") {
    assert.equal(nafta.intent, "expense");
    assert.equal(nafta.draft.kind, "EXPENSE");
    assert.equal(nafta.draft.categoryId, "exp-transporte");
    assert.equal(nafta.draft.date, "2026-11-02");
  }
  const luz = mockInterpret("pagué la luz 20 mil todos los meses", ctx);
  assert.equal(luz.entry?.categoryName, "Servicios");
  assert.equal(luz.entry?.frequency, "MONTHLY");
  const sinCat = mockInterpret("gasté 800", ctx);
  assert.equal(sinCat.entry?.categoryName, null);
  assert.equal(mockInterpret("compré una tele en 12 cuotas", ctx).intent, "card_purchase");
  assert.equal(mockInterpret("gasté 50 mil con la visa en cuotas", ctx).intent, "card_purchase");
});

test("mockInterpret: cada intención", () => {
  const intent = (t: string) => mockInterpret(t, ctx).intent;
  assert.equal(intent("gasté 5 mil en el súper"), "expense");
  assert.equal(intent("le debo 200 mil a mi papá"), "debt");
  assert.equal(intent("le presté plata a Juan"), "debt");
  assert.equal(intent("compré una heladera en 6 cuotas con la visa"), "card_purchase");
  assert.equal(intent("el resumen de la tarjeta"), "card_statement");
  assert.equal(intent("hola, cómo estás"), "chat");
  assert.equal(intent("contame un chiste"), "chat");
  assert.equal(intent("blablabla"), "unclear");
  assert.equal(intent("   "), "unclear");
});

test("mockOutcome pasa por resolveVoiceOutcome", () => {
  const o = mockOutcome("cobré el sueldo 2 millones", ctx);
  assert.equal(o.kind, "draft");
  if (o.kind === "draft") {
    assert.equal(o.draft.categoryId, "ic-sueldo");
    assert.equal(o.draft.amount, 2_000_000);
  }
  assert.equal(mockOutcome("quiero pagar la deuda", ctx).kind, "notYet");
  assert.equal(mockOutcome("hola", ctx).kind, "chat");
});

test("mock: audio usa el texto de ejemplo y los textos 'error' lanzan AppError", async () => {
  const o = await mockSource.interpretVoice({ audioUri: "file:///x.m4a", mimeType: "audio/m4a" });
  assert.equal(o.kind, "draft");
  await assert.rejects(mockSource.interpretVoice({ text: "error" }), (e: AppError) => e.retryable && !e.reported);
  await assert.rejects(mockSource.interpretVoice({ text: "error fatal" }), (e: AppError) => !e.retryable && e.reported);
});

test("mock: addEntry INCOME suma a Inicio", async () => {
  const before = await mockSource.getHome();
  await mockSource.addEntry({
    kind: "INCOME", period: before.period, name: "Freelance", amount: 100, currency: "ARS", categoryId: null, date: null, note: null, fixed: null,
  });
  const after = await mockSource.getHome();
  assert.equal(after.income, before.income + 100);
  assert.equal(after.available, before.available + 100);
  assert.equal(after.free, before.free + 100);
});

test("mock: addEntry EXPENSE resta del disponible; el libre solo baja si pasa del tope o no tenía", async () => {
  const before = await mockSource.getHome();
  // Dentro del tope de Supermercado: sale del disponible pero ya estaba reservado, el libre no cambia.
  await mockSource.addEntry({
    kind: "EXPENSE", period: before.period, name: "Súper", amount: 1_000, currency: "ARS",
    categoryId: "exp-supermercado", date: null, note: null, fixed: null,
  });
  const mid = await mockSource.getHome();
  assert.equal(mid.available, before.available - 1_000);
  assert.equal(mid.free, before.free);
  // Servicios no tiene tope: cada peso gastado baja el libre.
  await mockSource.addEntry({
    kind: "EXPENSE", period: before.period, name: "Varios", amount: 200, currency: "ARS",
    categoryId: "exp-servicios", date: null, note: null, fixed: null,
  });
  const after = await mockSource.getHome();
  assert.equal(after.income, before.income);
  assert.equal(after.available, before.available - 1_200);
  assert.equal(after.free, before.free - 200);
  const total = (h: typeof before) => h.spendingByCategory.reduce((sum, c) => sum + c.amount, 0);
  assert.equal(total(after), total(before) + 1_200);
});

test("mock: getCategories por tipo (gasto = las de la web + tarjetas)", async () => {
  const inc = await mockSource.getCategories("INCOME");
  const exp = await mockSource.getCategories("EXPENSE");
  assert.ok(inc.some((c) => c.id === "ic-sueldo"));
  assert.equal(exp.length, 15);
  assert.deepEqual(exp.slice(0, 4).map((c) => c.name), ["Alquiler", "Expensas", "Servicios", "Supermercado"]);
  assert.ok(exp.some((c) => c.name === "Ahorro e inversión") && exp.some((c) => c.name === "Tarjetas de crédito"));
});

test("toAppError: red, timeout y HTTP", () => {
  const same = new AppError("x", { code: "bad_audio" });
  assert.equal(toAppError(same), same);
  assert.equal(toAppError(Object.assign(new Error("n"), { status: 0 })).retryable, true);
  assert.equal(toAppError(Object.assign(new Error("n"), { status: 503 })).retryable, true);
  assert.equal(toAppError(Object.assign(new Error("n"), { status: 429 })).retryable, true);
  assert.equal(toAppError(Object.assign(new Error("n"), { status: 400 })).retryable, false);
  assert.equal(toAppError(Object.assign(new Error("n"), { status: 401 })).code, "unauthorized");
  const abort = new Error("aborted");
  abort.name = "AbortError";
  assert.deepEqual([toAppError(abort).code, toAppError(abort).retryable], ["timeout", true]);
  assert.equal(toAppError(new TypeError("Network request failed")).retryable, true);
  const other = toAppError("boom");
  assert.deepEqual([other.message, other.retryable, other.reported], ["boom", false, false]);
});
