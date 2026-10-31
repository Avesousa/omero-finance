import { useSyncExternalStore } from "react";
import { conversationReducer, initialConversation, type ConversationInput, type ConversationState } from "./reducer.ts";
import type { ChatMessage } from "./types.ts";

let state: ConversationState = initialConversation;
let counter = 0;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const getState = () => state;

/** Store en memoria del hilo de Cargar. Se usa también desde otras pantallas (el formulario avisa si guardó). */
export const conversation = {
  getState,
  subscribe,
  /** Despacha una acción (el store le pone la hora). */
  dispatch(action: ConversationInput) {
    const next = conversationReducer(state, { ...action, at: Date.now() } as Parameters<typeof conversationReducer>[1]);
    if (next === state) return;
    state = next;
    listeners.forEach((l) => l());
  },
  /** Id único para mensajes del usuario y borradores. */
  newId: (prefix = "u") => `${prefix}${Date.now().toString(36)}-${(counter++).toString(36)}`,
  find: (id: string): ChatMessage | undefined => state.messages.find((m) => m.id === id),
};

/** Mensajes del hilo + `dispatch`. */
export function useLoadConversation() {
  const s = useSyncExternalStore(subscribe, getState, getState);
  return { messages: s.messages, dispatch: conversation.dispatch };
}
