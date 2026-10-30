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
  assert.equal(e.income?.amount, 1_200_000);
  assert.equal(e.income?.categoryName, "Sueldo");
  assert.equal(e.income?.fixed, false);

  const usd = mockInterpret("Cobré 300 dólares de freelance ayer", ctx);
  assert.equal(usd.income?.currency, "USD");
  assert.equal(usd.income?.categoryName, "Freelance");
  assert.equal(usd.income?.date, "2026-11-02");

  const fijo = mockInterpret("Me depositan alquiler, ingreso de 150 mil todos los meses", ctx);
  assert.equal(fijo.income?.fixed, true);
  assert.equal(fijo.income?.frequency, "MONTHLY");
  assert.equal(fijo.income?.categoryName, "Alquileres");
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
  assert.deepEqual(mockOutcome("gasté 100", ctx), { kind: "notYet", intent: "expense", transcript: "gasté 100" });
  assert.equal(mockOutcome("hola", ctx).kind, "chat");
});

test("mock: audio usa el texto de ejemplo y los textos 'error' lanzan AppError", async () => {
  const o = await mockSource.interpretVoice({ audioUri: "file:///x.m4a", mimeType: "audio/m4a" });
  assert.equal(o.kind, "draft");
  await assert.rejects(mockSource.interpretVoice({ text: "error" }), (e: AppError) => e.retryable && !e.reported);
  await assert.rejects(mockSource.interpretVoice({ text: "error fatal" }), (e: AppError) => !e.retryable && e.reported);
});

test("mock: addIncome suma a Inicio", async () => {
  const before = await mockSource.getHome();
  await mockSource.addIncome({
    period: before.period, name: "Freelance", amount: 100, currency: "ARS", categoryId: null, date: null, note: null, fixed: null,
  });
  const after = await mockSource.getHome();
  assert.equal(after.income, before.income + 100);
  assert.equal(after.available, before.available + 100);
  assert.equal(after.free, before.free + 100);
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
