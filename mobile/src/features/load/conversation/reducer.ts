import type { VoiceOutcome, VoicePendingIntent } from "../../../domain/index.ts";
import type { MascotMoment } from "../../../mascots/types.ts";
import type { ChatMessage, MascotDraftMessage } from "./types.ts";
import { isDraftComplete } from "./draft.ts";

export interface ConversationState {
  messages: ChatMessage[];
  /** Contador para ids generados por el reducer (`m<n>`). */
  seq: number;
}

export const initialConversation: ConversationState = { messages: [], seq: 0 };

/** Lo mínimo que el reducer necesita saber de un `AppError`. */
export interface ChatErrorInfo {
  code: string;
  retryable: boolean;
}

/** Cada acción lleva `at` (epoch ms): el reducer no lee el reloj. Los ids de mensajes del usuario y de borradores los pone quien despacha. */
export type ConversationAction =
  | { type: "start"; at: number }
  | { type: "userText"; at: number; id: string; text: string }
  | { type: "userAudio"; at: number; id: string; uri: string; durationMs: number; waveform: number[] }
  /** Aparece "escribiendo…". Con `forMessageId` (reintento) se limpia antes el error de ese mensaje. */
  | { type: "thinking"; at: number; forMessageId?: string }
  | { type: "outcome"; at: number; outcome: VoiceOutcome; forMessageId: string; draftId?: string }
  | { type: "error"; at: number; error: ChatErrorInfo; forMessageId: string }
  /** La mascota dice un momento suelto (sin permiso de micrófono, audio muy corto…). */
  | { type: "say"; at: number; moment: MascotMoment }
  /** Confirmar: la tarjeta pasa a "guardando". */
  | { type: "draftSaving"; at: number; draftId: string }
  /** Se guardó (confirmando o desde el formulario): tarjeta ✓ + frase de la mascota según el tipo. */
  | { type: "draftSaved"; at: number; draftId: string; amount: string }
  /** Falló el guardado: la tarjeta vuelve a "pendiente" con el aviso y la mascota pide reintentar. */
  | { type: "draftFailed"; at: number; draftId: string; /** El mes no está iniciado en la web: la mascota lo explica en vez de pedir reintentar. */ monthNotStarted?: boolean }
  /** Se cargó algo a mano desde una opción del chat (formulario abierto arriba del hilo). */
  | { type: "manualSaved"; at: number; kind: "income" | "expense" | "debt"; amount?: string; name?: string }
  | { type: "reset" };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** Lo que se despacha desde afuera: el store agrega `at`. */
export type ConversationInput = DistributiveOmit<ConversationAction, "at">;

const withoutTyping = (messages: ChatMessage[]) => messages.filter((m) => m.kind !== "mascot.typing");

function push(state: ConversationState, messages: ChatMessage[], extra: Partial<ConversationState> = {}): ConversationState {
  return { ...state, ...extra, messages: [...state.messages, ...messages] };
}

function hasMessage(state: ConversationState, id: string): boolean {
  return state.messages.some((m) => m.id === id);
}

function line(id: string, at: number, moment: MascotMoment, extra: { intent?: VoicePendingIntent } = {}): ChatMessage {
  return { id, at, from: "mascot", kind: "mascot.line", moment, ...extra };
}

const SAVED_MOMENT = { income: "incomeSaved", expense: "expenseSaved", debt: "debtSaved" } as const;

function savedLine(id: string, at: number, kind: keyof typeof SAVED_MOMENT, vars: Record<string, string | number>): ChatMessage {
  return { id, at, from: "mascot", kind: "mascot.line", moment: SAVED_MOMENT[kind], vars };
}

function patchDraft(state: ConversationState, draftId: string, patch: Partial<MascotDraftMessage>): ConversationState {
  return {
    ...state,
    messages: state.messages.map((m) => (m.kind === "mascot.draft" && m.draftId === draftId ? { ...m, ...patch } : m)),
  };
}

const findDraft = (state: ConversationState, draftId: string) =>
  state.messages.find((m): m is MascotDraftMessage => m.kind === "mascot.draft" && m.draftId === draftId);

export function conversationReducer(state: ConversationState, action: ConversationAction): ConversationState {
  switch (action.type) {
    case "reset":
      return initialConversation;

    case "start": {
      if (state.messages.length > 0) return state; // idempotente (StrictMode, remontajes)
      const n = state.seq;
      return {
        seq: n + 2,
        messages: [line(`m${n}`, action.at, "loadGreeting"), { id: `m${n + 1}`, at: action.at, from: "mascot", kind: "mascot.options" }],
      };
    }

    case "userText":
      if (hasMessage(state, action.id)) return state;
      return push(state, [{ id: action.id, at: action.at, from: "user", kind: "user.text", text: action.text }]);

    case "userAudio":
      if (hasMessage(state, action.id)) return state;
      return push(state, [
        { id: action.id, at: action.at, from: "user", kind: "user.audio", uri: action.uri, durationMs: action.durationMs, waveform: action.waveform },
      ]);

    case "thinking": {
      let messages = state.messages;
      const forId = action.forMessageId;
      if (forId) {
        // Reintento: sale el error (y la frase de "no pude") de ese mensaje.
        const errIdx = messages.findIndex((m) => m.kind === "mascot.error" && m.retryOf === forId);
        if (errIdx >= 0) {
          const prev = messages[errIdx - 1];
          const drop = new Set([errIdx, ...(prev && prev.kind === "mascot.line" && prev.moment === "voiceErrorRetry" ? [errIdx - 1] : [])]);
          messages = messages.filter((_, i) => !drop.has(i));
        }
      }
      messages = withoutTyping(messages);
      return { seq: state.seq + 1, messages: [...messages, { id: `m${state.seq}`, at: action.at, from: "mascot", kind: "mascot.typing" }] };
    }

    case "outcome": {
      if (!hasMessage(state, action.forMessageId)) return state; // llegó tarde: el hilo ya se reinició
      const { outcome } = action;
      const fromAudio = state.messages.some((m) => m.id === action.forMessageId && m.kind === "user.audio");
      const base = withoutTyping(state.messages).map((m) =>
        m.id === action.forMessageId && m.kind === "user.audio" ? { ...m, transcript: outcome.transcript } : m,
      );
      const n = state.seq;
      const next: ConversationState = { seq: n + 1, messages: base };
      switch (outcome.kind) {
        case "draft": {
          const draftId = action.draftId ?? `d${n}`;
          return push(next, [
            // Completo: "revisalo y confirmalo". Incompleto: pide lo que falta.
            line(`m${n}`, action.at, isDraftComplete(outcome.draft) ? "voiceDraftReady" : "voiceDraftIncomplete"),
            {
              id: `m${n + 1}`,
              at: action.at,
              from: "mascot",
              kind: "mascot.draft",
              draftId,
              intent: outcome.intent,
              draft: outcome.draft,
              source: fromAudio ? "audio" : "text",
              ...(fromAudio ? { transcript: outcome.transcript } : {}),
              status: "pending",
            },
          ], { seq: n + 2 });
        }
        case "notYet":
          return push(next, [line(`m${n}`, action.at, "voiceNotYet", { intent: outcome.intent })]);
        case "chat":
          return push(next, [line(`m${n}`, action.at, "voiceChat")]);
        case "unclear":
          return push(next, [line(`m${n}`, action.at, "voiceUnclear")]);
      }
      return next;
    }

    case "error": {
      if (!hasMessage(state, action.forMessageId)) return state;
      const base = withoutTyping(state.messages);
      const n = state.seq;
      const next: ConversationState = { seq: n + 1, messages: base };
      if (action.error.code === "bad_audio") return push(next, [line(`m${n}`, action.at, "voiceUnclear")]);
      if (action.error.retryable) {
        return push(
          next,
          [
            line(`m${n}`, action.at, "voiceErrorRetry"),
            { id: `m${n + 1}`, at: action.at, from: "mascot", kind: "mascot.error", retryOf: action.forMessageId, retryable: true },
          ],
          { seq: n + 2 },
        );
      }
      return push(next, [line(`m${n}`, action.at, "voiceErrorReported")]);
    }

    case "say":
      return push({ ...state, seq: state.seq + 1 }, [line(`m${state.seq}`, action.at, action.moment)]);

    case "draftSaving": {
      const draft = findDraft(state, action.draftId);
      if (!draft || draft.status !== "pending") return state;
      return patchDraft(state, action.draftId, { status: "saving", error: false });
    }

    case "draftSaved": {
      const draft = findDraft(state, action.draftId);
      if (!draft || draft.status === "saved") return state;
      const patched = patchDraft(state, action.draftId, { status: "saved", savedAmount: action.amount, error: false });
      const n = patched.seq;
      return push({ ...patched, seq: n + 1 }, [savedLine(`m${n}`, action.at, draft.intent, { amount: action.amount })]);
    }

    case "draftFailed": {
      const draft = findDraft(state, action.draftId);
      if (!draft || draft.status !== "saving") return state;
      const patched = patchDraft(state, action.draftId, { status: "pending", error: true });
      const n = patched.seq;
      return push({ ...patched, seq: n + 1 }, [line(`m${n}`, action.at, action.monthNotStarted ? "monthNotStarted" : "voiceErrorRetry")]);
    }

    case "manualSaved": {
      const n = state.seq;
      const vars: Record<string, string> = action.kind === "debt" ? { name: action.name ?? "" } : { amount: action.amount ?? "" };
      return push({ ...state, seq: n + 1 }, [savedLine(`m${n}`, action.at, action.kind, vars)]);
    }
  }
}
