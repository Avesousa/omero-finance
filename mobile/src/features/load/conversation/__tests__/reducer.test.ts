import test from "node:test";
import assert from "node:assert/strict";
import { conversationReducer as reduce, initialConversation, type ConversationAction, type ConversationState } from "../reducer.ts";
import type { MascotDraftMessage, MascotLineMessage } from "../types.ts";
import type { IncomeDraft, VoiceOutcome } from "../../../../domain/index.ts";

const draft: IncomeDraft = { name: "Sueldo", amount: 1000, currency: "ARS", categoryId: null, date: null, fixed: null, note: null };
const draftOutcome: VoiceOutcome = { kind: "draft", intent: "income", transcript: "cobré mil", draft };

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

test("outcome draft: reemplaza el typing por frase + tarjeta pendiente y guarda la transcripción del audio", () => {
  const s = run([audio(), { type: "thinking", at: 2 }, { type: "outcome", at: 3, outcome: draftOutcome, forMessageId: "u1", draftId: "d1" }]);
  assert.deepEqual(kinds(s), ["user.audio", "mascot.line", "mascot.draft"]);
  assert.deepEqual(moments(s), ["voiceDraftReady"]);
  const a = s.messages[0];
  assert.equal(a.kind === "user.audio" && a.transcript, "cobré mil");
  const d = s.messages[2] as MascotDraftMessage;
  assert.equal(d.draftId, "d1");
  assert.equal(d.status, "pending");
  assert.equal(d.transcript, "cobré mil");
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
  const drafted = run([audio(), { type: "outcome", at: 2, outcome: draftOutcome, forMessageId: "u1", draftId: "d1" }]);
  const s = reduce(drafted, { type: "draftSaved", at: 3, draftId: "d1", amount: "$ 1.000" });
  const d = s.messages.find((m) => m.kind === "mascot.draft") as MascotDraftMessage;
  assert.equal(d.status, "saved");
  assert.equal(d.savedAmount, "$ 1.000");
  const last = s.messages.at(-1) as MascotLineMessage;
  assert.equal(last.moment, "incomeSaved");
  assert.deepEqual(last.vars, { amount: "$ 1.000" });
  assert.equal(reduce(s, { type: "draftSaved", at: 4, draftId: "d1", amount: "$ 1.000" }), s);
  assert.equal(reduce(drafted, { type: "draftSaved", at: 4, draftId: "nope", amount: "x" }), drafted);
});

test("draftDismissed: una sola vez, y no pisa un guardado", () => {
  const drafted = run([audio(), { type: "outcome", at: 2, outcome: draftOutcome, forMessageId: "u1", draftId: "d1" }]);
  const s = reduce(drafted, { type: "draftDismissed", at: 3, draftId: "d1" });
  assert.equal((s.messages.find((m) => m.kind === "mascot.draft") as MascotDraftMessage).status, "dismissed");
  assert.equal(moments(s).filter((m) => m === "draftDismissed").length, 1);
  assert.equal(reduce(s, { type: "draftDismissed", at: 4, draftId: "d1" }), s);
  // Retomar y guardar después de descartar sí vale.
  const saved = reduce(s, { type: "draftSaved", at: 5, draftId: "d1", amount: "$ 1" });
  assert.equal((saved.messages.find((m) => m.kind === "mascot.draft") as MascotDraftMessage).status, "saved");
  const savedThenDismiss = reduce(reduce(drafted, { type: "draftSaved", at: 3, draftId: "d1", amount: "$ 1" }), { type: "draftDismissed", at: 4, draftId: "d1" });
  assert.equal(moments(savedThenDismiss).includes("draftDismissed"), false);
});

test("say y reset; ids únicos", () => {
  const s = run([{ type: "start", at: 1 }, { type: "say", at: 2, moment: "voicePermission" }, { type: "say", at: 3, moment: "voiceUnclear" }]);
  assert.deepEqual(moments(s), ["loadGreeting", "voicePermission", "voiceUnclear"]);
  assert.equal(new Set(s.messages.map((m) => m.id)).size, s.messages.length);
  assert.equal(reduce(s, { type: "reset" }), initialConversation);
});
