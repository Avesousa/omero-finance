import test from "node:test";
import assert from "node:assert/strict";
import { conversationReducer as reduce, initialConversation, type ConversationAction, type ConversationState } from "../reducer.ts";
import { draftToEntryInput, isDraftComplete } from "../draft.ts";
import type { MascotDraftMessage, MascotLineMessage } from "../types.ts";
import type { EntryDraft, VoiceOutcome } from "../../../../domain/index.ts";

const draft: EntryDraft = { kind: "INCOME", name: "Sueldo", amount: 1000, currency: "ARS", categoryId: null, date: null, fixed: null, note: null };
const draftOutcome: VoiceOutcome = { kind: "draft", intent: "income", transcript: "cobré mil", draft };

const expenseDraft: EntryDraft = { ...draft, kind: "EXPENSE", name: "Súper", amount: 5000, categoryId: "exp-super" };
const expenseOutcome: VoiceOutcome = { kind: "draft", intent: "expense", transcript: "gasté 5 mil en el súper", draft: expenseDraft };
const textDrafted = (outcome: VoiceOutcome = draftOutcome) =>
  run([{ type: "userText", at: 1, id: "u1", text: "x" }, { type: "outcome", at: 2, outcome, forMessageId: "u1", draftId: "d1" }]);
const audioDrafted = (outcome: VoiceOutcome = draftOutcome) =>
  run([audio(), { type: "outcome", at: 2, outcome, forMessageId: "u1", draftId: "d1" }]);
const findDraftMsg = (s: ConversationState) => s.messages.find((m) => m.kind === "mascot.draft") as MascotDraftMessage;

const run = (actions: ConversationAction[], from: ConversationState = initialConversation) => actions.reduce(reduce, from);
const kinds = (s: ConversationState) => s.messages.map((m) => m.kind);
const moments = (s: ConversationState) => s.messages.filter((m): m is MascotLineMessage => m.kind === "mascot.line").map((m) => m.moment);
const audio = (id = "u1"): ConversationAction => ({ type: "userAudio", at: 1, id, uri: "file://a.m4a", durationMs: 3000, waveform: [0.5] });

test("start: saludo + opciones, y es idempotente", () => {
  const s = run([{ type: "start", at: 1 }]);
  assert.deepEqual(kinds(s), ["mascot.line", "mascot.options"]);
  assert.deepEqual(moments(s), ["loadGreeting"]);
  assert.equal(reduce(s, { type: "start", at: 2 }), s);
});

test("userText + thinking: aparece un solo 'escribiendo'", () => {
  const s = run([{ type: "start", at: 1 }, { type: "userText", at: 2, id: "u1", text: "hola" }, { type: "thinking", at: 3 }, { type: "thinking", at: 4 }]);
  assert.equal(s.messages.filter((m) => m.kind === "mascot.typing").length, 1);
  assert.equal(s.messages.at(-1)?.kind, "mascot.typing");
});

test("outcome draft de audio: frase + tarjeta pendiente con source audio, y guarda la transcripción", () => {
  const s = run([audio(), { type: "thinking", at: 2 }, { type: "outcome", at: 3, outcome: draftOutcome, forMessageId: "u1", draftId: "d1" }]);
  assert.deepEqual(kinds(s), ["user.audio", "mascot.line", "mascot.draft"]);
  assert.deepEqual(moments(s), ["voiceDraftReady"]);
  const a = s.messages[0];
  assert.equal(a.kind === "user.audio" && a.transcript, "cobré mil");
  const d = findDraftMsg(s);
  assert.equal(d.draftId, "d1");
  assert.equal(d.status, "pending");
  assert.equal(d.source, "audio");
  assert.equal(d.transcript, "cobré mil");
});

test("outcome draft de texto: source text y sin transcripción (el formulario no muestra 'Escuché')", () => {
  const d = findDraftMsg(textDrafted());
  assert.equal(d.source, "text");
  assert.equal("transcript" in d, false);
  assert.equal(d.intent, "income");
});

test("outcome draft de gasto: intent expense y el borrador conserva el tipo", () => {
  const d = findDraftMsg(textDrafted(expenseOutcome));
  assert.equal(d.intent, "expense");
  assert.equal(d.draft.kind, "EXPENSE");
});

test("outcome texto: no agrega transcripción a la burbuja", () => {
  const s = run([{ type: "userText", at: 1, id: "u1", text: "x" }, { type: "outcome", at: 2, outcome: { kind: "chat", transcript: "x" }, forMessageId: "u1" }]);
  assert.deepEqual(moments(s), ["voiceChat"]);
  assert.equal("transcript" in s.messages[0], false);
});

test("outcome unclear y notYet", () => {
  const base = run([{ type: "userText", at: 1, id: "u1", text: "x" }]);
  assert.deepEqual(moments(reduce(base, { type: "outcome", at: 2, outcome: { kind: "unclear", transcript: "" }, forMessageId: "u1" })), ["voiceUnclear"]);
  const s = reduce(base, { type: "outcome", at: 2, outcome: { kind: "notYet", intent: "expense", transcript: "x" }, forMessageId: "u1" });
  const line = s.messages.at(-1) as MascotLineMessage;
  assert.equal(line.moment, "voiceNotYet");
  assert.equal(line.intent, "expense");
});

test("outcome/error para un mensaje que ya no está (hilo reiniciado) se ignora", () => {
  assert.equal(reduce(initialConversation, { type: "outcome", at: 1, outcome: draftOutcome, forMessageId: "zz" }), initialConversation);
  assert.equal(reduce(initialConversation, { type: "error", at: 1, error: { code: "network", retryable: true }, forMessageId: "zz" }), initialConversation);
});

test("error reintentable: frase + mascot.error; retry los limpia y vuelve a escribir", () => {
  let s = run([audio(), { type: "thinking", at: 2 }, { type: "error", at: 3, error: { code: "network", retryable: true }, forMessageId: "u1" }]);
  assert.deepEqual(kinds(s), ["user.audio", "mascot.line", "mascot.error"]);
  assert.deepEqual(moments(s), ["voiceErrorRetry"]);
  const err = s.messages[2];
  assert.equal(err.kind === "mascot.error" && err.retryOf, "u1");
  s = reduce(s, { type: "thinking", at: 4, forMessageId: "u1" });
  assert.deepEqual(kinds(s), ["user.audio", "mascot.typing"]);
});

test("error no reintentable y bad_audio", () => {
  const base = run([audio(), { type: "thinking", at: 2 }]);
  const a = reduce(base, { type: "error", at: 3, error: { code: "unauthorized", retryable: false }, forMessageId: "u1" });
  assert.deepEqual(kinds(a), ["user.audio", "mascot.line"]);
  assert.deepEqual(moments(a), ["voiceErrorReported"]);
  const b = reduce(base, { type: "error", at: 3, error: { code: "bad_audio", retryable: false }, forMessageId: "u1" });
  assert.deepEqual(moments(b), ["voiceUnclear"]);
});

test("draftSaved: marca la tarjeta y agrega incomeSaved con el monto; no se repite", () => {
  const drafted = audioDrafted();
  const s = reduce(drafted, { type: "draftSaved", at: 3, draftId: "d1", amount: "$ 1.000" });
  const d = findDraftMsg(s);
  assert.equal(d.status, "saved");
  assert.equal(d.savedAmount, "$ 1.000");
  const last = s.messages.at(-1) as MascotLineMessage;
  assert.equal(last.moment, "incomeSaved");
  assert.deepEqual(last.vars, { amount: "$ 1.000" });
  assert.equal(reduce(s, { type: "draftSaved", at: 4, draftId: "d1", amount: "$ 1.000" }), s);
  assert.equal(reduce(drafted, { type: "draftSaved", at: 4, draftId: "nope", amount: "x" }), drafted);
});

test("draftSaved de un gasto dice expenseSaved", () => {
  const s = reduce(textDrafted(expenseOutcome), { type: "draftSaved", at: 3, draftId: "d1", amount: "$ 5.000" });
  assert.equal((s.messages.at(-1) as MascotLineMessage).moment, "expenseSaved");
});

test("confirmar: pending → saving → saved; el segundo draftSaving se ignora", () => {
  const saving = reduce(textDrafted(), { type: "draftSaving", at: 3, draftId: "d1" });
  assert.equal(findDraftMsg(saving).status, "saving");
  assert.equal(reduce(saving, { type: "draftSaving", at: 4, draftId: "d1" }), saving);
  const saved = reduce(saving, { type: "draftSaved", at: 5, draftId: "d1", amount: "$ 1.000" });
  assert.equal(findDraftMsg(saved).status, "saved");
  assert.equal(reduce(saved, { type: "draftSaving", at: 6, draftId: "d1" }), saved);
});

test("draftFailed: vuelve a pending con error y la mascota pide reintentar; reintentar limpia el error", () => {
  const saving = reduce(textDrafted(), { type: "draftSaving", at: 3, draftId: "d1" });
  const failed = reduce(saving, { type: "draftFailed", at: 4, draftId: "d1" });
  const d = findDraftMsg(failed);
  assert.equal(d.status, "pending");
  assert.equal(d.error, true);
  assert.equal(moments(failed).at(-1), "voiceErrorRetry");
  assert.equal(reduce(textDrafted(), { type: "draftFailed", at: 4, draftId: "d1" }).messages.length, textDrafted().messages.length); // no estaba guardando
  const again = reduce(failed, { type: "draftSaving", at: 5, draftId: "d1" });
  assert.equal(findDraftMsg(again).error, false);
});

test("cerrar el formulario sin guardar no cambia nada: la tarjeta sigue pending, sin frase nueva", () => {
  const s = textDrafted();
  assert.equal(findDraftMsg(s).status, "pending");
  assert.deepEqual(moments(s), ["voiceDraftReady"]);
});

test("manualSaved: la mascota confirma ingreso, gasto y deuda", () => {
  const income = reduce(initialConversation, { type: "manualSaved", at: 1, kind: "income", amount: "$ 10" });
  const expense = reduce(income, { type: "manualSaved", at: 2, kind: "expense", amount: "$ 20" });
  const debt = reduce(expense, { type: "manualSaved", at: 3, kind: "debt", name: "Préstamo" });
  assert.deepEqual(moments(debt), ["incomeSaved", "expenseSaved", "debtSaved"]);
  assert.deepEqual((debt.messages[0] as MascotLineMessage).vars, { amount: "$ 10" });
  assert.deepEqual((debt.messages[2] as MascotLineMessage).vars, { name: "Préstamo" });
  assert.equal(new Set(debt.messages.map((m) => m.id)).size, 3);
});

test("isDraftComplete: monto > 0 y (nombre o categoría)", () => {
  assert.equal(isDraftComplete(draft), true);
  assert.equal(isDraftComplete({ ...draft, amount: null }), false);
  assert.equal(isDraftComplete({ ...draft, amount: 0 }), false);
  assert.equal(isDraftComplete({ ...draft, name: null }), false);
  assert.equal(isDraftComplete({ ...draft, name: "  " }), false);
  assert.equal(isDraftComplete({ ...draft, name: null, categoryId: "exp-super" }), true);
});

test("draftToEntryInput: usa el nombre de la categoría si falta, y arma período y fijo", () => {
  const noName: EntryDraft = { ...expenseDraft, name: null, date: "2026-11-05", fixed: { frequency: "MONTHLY" }, note: " " };
  const input = draftToEntryInput(noName, "Supermercado", "2026-11-20");
  assert.deepEqual(input, {
    kind: "EXPENSE", period: "2026-11", name: "Supermercado", amount: 5000, currency: "ARS",
    categoryId: "exp-super", date: "2026-11-05", note: null, fixed: { frequency: "MONTHLY" },
  });
  assert.equal(draftToEntryInput(noName, undefined, "2026-11-20"), null);
  assert.equal(draftToEntryInput({ ...draft, amount: null }, "x"), null);
  assert.equal(draftToEntryInput(draft, null, "2026-12-01")?.period, "2026-12");
});

test("say y reset; ids únicos", () => {
  const s = run([{ type: "start", at: 1 }, { type: "say", at: 2, moment: "voicePermission" }, { type: "say", at: 3, moment: "voiceUnclear" }]);
  assert.deepEqual(moments(s), ["loadGreeting", "voicePermission", "voiceUnclear"]);
  assert.equal(new Set(s.messages.map((m) => m.id)).size, s.messages.length);
  assert.equal(reduce(s, { type: "reset" }), initialConversation);
});
