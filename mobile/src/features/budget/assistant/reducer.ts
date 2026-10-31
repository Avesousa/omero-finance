import { parseSpokenAmount } from "../../../domain/amountText.ts";
import type { MascotMoment } from "../../../mascots/types.ts";
import type { AssistantLine, AssistantMessage, AssistantTarget } from "./types.ts";

/**
 * Fases del asistente:
 * - `idle`: todavía no empezó.
 * - `ask`: pregunta por una categoría (Igual / Cambiar / Saltar, o escribir el monto).
 * - `amount`: pidió el monto y espera que lo escriban.
 * - `more`: "¿agregamos otra categoría?" (chips de categorías sin tope + "No, listo").
 * - `summary`: tarjeta final con Confirmar. `saving`: guardando. `saved`: listo.
 */
export type AssistantPhase = "idle" | "ask" | "amount" | "more" | "summary" | "saving" | "saved";

export interface AssistantState {
  messages: AssistantMessage[];
  /** Contador para los ids de mensajes de la mascota (`m<n>`). */
  seq: number;
  phase: AssistantPhase;
  /** Categorías que faltan preguntar, en orden. */
  queue: AssistantTarget[];
  /** Categorías que se pueden agregar a pedido. */
  extras: AssistantTarget[];
  /** La categoría por la que se pregunta ahora. */
  current: AssistantTarget | null;
  /** Lo decidido hasta ahora (monto > 0), en orden de aparición. */
  lines: AssistantLine[];
  /** El último intento de guardar falló. */
  error: boolean;
}

export const initialAssistant: AssistantState = {
  messages: [],
  seq: 0,
  phase: "idle",
  queue: [],
  extras: [],
  current: null,
  lines: [],
  error: false,
};

/** Cada acción lleva `at` (epoch ms): el reducer no lee el reloj. Los ids de mensajes del usuario los pone quien despacha. */
export type AssistantAction =
  | { type: "start"; at: number; steps: AssistantTarget[]; extras: AssistantTarget[] }
  | { type: "choose"; at: number; id: string; choice: "same" | "change" | "skip" }
  | { type: "text"; at: number; id: string; text: string }
  | { type: "pickExtra"; at: number; id: string; categoryId: string }
  | { type: "noMore"; at: number; id: string }
  | { type: "confirm"; at: number; id: string }
  /** Se guardó: `free` es el "Sin asignar" que quedó. */
  | { type: "saved"; at: number; free: number }
  | { type: "saveFailed"; at: number }
  | { type: "reset" };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** Lo que se despacha desde afuera: el hook agrega `at`. */
export type AssistantInput = DistributiveOmit<AssistantAction, "at">;

/** Lo que la mascota propone para una categoría: el tope del mes anterior; si no hay, lo gastado; si no, nada. */
export function proposalOf(target: AssistantTarget): { amount: number; source: "previous" | "spent" } | null {
  if (target.previous !== null && target.previous > 0) return { amount: target.previous, source: "previous" };
  if (target.spentNow > 0) return { amount: Math.round(target.spentNow), source: "spent" };
  return null;
}

function mascot(state: AssistantState, at: number, moment: MascotMoment, vars?: { name?: string; amount?: number }): AssistantState {
  const seq = state.seq + 1;
  return { ...state, seq, messages: [...state.messages, { id: `m${seq}`, at, from: "mascot", kind: "mascot.line", moment, ...(vars ? { vars } : {}) }] };
}

function user(state: AssistantState, message: AssistantMessage): AssistantState {
  return { ...state, messages: [...state.messages, message] };
}

/** La mascota pregunta por `target`: con tope del mes anterior lo cita; si no, pregunta cuánto. */
function ask(state: AssistantState, at: number, target: AssistantTarget): AssistantState {
  const savings = target.kind === "savings";
  const hasPrevious = target.previous !== null && target.previous > 0;
  const moment: MascotMoment = savings
    ? hasPrevious ? "budgetAssistSavings" : "budgetAssistSavingsNew"
    : hasPrevious ? "budgetAssistCategory" : "budgetAssistCategoryNew";
  const vars = hasPrevious ? { name: target.name, amount: target.previous as number } : { name: target.name };
  return mascot({ ...state, phase: "ask", current: target }, at, moment, vars);
}

/** Pasa a lo que sigue: la próxima categoría, "¿agregamos otra?" si quedan extras, o el resumen. */
function advance(state: AssistantState, at: number): AssistantState {
  const base: AssistantState = { ...state, current: null };
  const [next, ...rest] = base.queue;
  if (next) return ask({ ...base, queue: rest }, at, next);
  if (base.extras.length > 0) return mascot({ ...base, phase: "more" }, at, "budgetAssistMore");
  return summarize(base, at);
}

function summarize(state: AssistantState, at: number): AssistantState {
  const seq = state.seq + 1;
  return {
    ...state,
    seq,
    phase: "summary",
    current: null,
    messages: [...state.messages, { id: `m${seq}`, at, from: "mascot", kind: "mascot.summary", lines: state.lines.map((l) => ({ ...l })) }],
  };
}

/** Anota (o reemplaza) el tope de la categoría actual. */
function record(state: AssistantState, amount: number): AssistantState {
  const target = state.current;
  if (!target || !(amount > 0)) return state;
  const line: AssistantLine = { categoryId: target.categoryId, name: target.name, amount: Math.round(amount) };
  const exists = state.lines.some((l) => l.categoryId === line.categoryId);
  return { ...state, lines: exists ? state.lines.map((l) => (l.categoryId === line.categoryId ? line : l)) : [...state.lines, line] };
}

export function assistantReducer(state: AssistantState, action: AssistantAction): AssistantState {
  switch (action.type) {
    case "reset":
      return initialAssistant;

    case "start": {
      if (state.phase !== "idle") return state;
      const [first, ...rest] = action.steps;
      const intro = mascot({ ...state, queue: rest, extras: action.extras }, action.at, "budgetAssistIntro");
      if (first) return ask(intro, action.at, first);
      return advance(intro, action.at);
    }

    case "choose": {
      // Saltar también vale mientras espera el monto; Igual y Cambiar solo con la pregunta abierta.
      const open = state.phase === "ask" || (state.phase === "amount" && action.choice === "skip");
      if (!open || !state.current) return state;
      const target = state.current;
      if (action.choice === "same") {
        const proposal = proposalOf(target);
        if (!proposal) return state;
        const next = user(state, { id: action.id, at: action.at, from: "user", kind: "user.choice", choice: "same", amount: proposal.amount });
        return advance(record(next, proposal.amount), action.at);
      }
      if (action.choice === "change") {
        const next = user(state, { id: action.id, at: action.at, from: "user", kind: "user.choice", choice: "change" });
        return mascot({ ...next, phase: "amount" }, action.at, "budgetAssistAskAmount");
      }
      const next = user(state, { id: action.id, at: action.at, from: "user", kind: "user.choice", choice: "skip" });
      return advance(next, action.at);
    }

    case "text": {
      if ((state.phase !== "ask" && state.phase !== "amount") || !state.current) return state;
      const text = action.text.trim();
      if (!text) return state;
      const next = user(state, { id: action.id, at: action.at, from: "user", kind: "user.text", text });
      const amount = parseSpokenAmount(text);
      // Sin monto entendible: vuelve a pedirlo (también si estaba en "ask": escribir sin tocar "Cambiar" equivale a cambiar).
      if (amount === null) return mascot({ ...next, phase: "amount" }, action.at, "budgetAssistAskAmount");
      return advance(record(next, amount), action.at);
    }

    case "pickExtra": {
      if (state.phase !== "more") return state;
      const target = state.extras.find((e) => e.categoryId === action.categoryId);
      if (!target) return state;
      const next = user({ ...state, extras: state.extras.filter((e) => e.categoryId !== target.categoryId) }, {
        id: action.id,
        at: action.at,
        from: "user",
        kind: "user.choice",
        choice: "pick",
        name: target.name,
      });
      return ask(next, action.at, target);
    }

    case "noMore": {
      if (state.phase !== "more") return state;
      return summarize(user(state, { id: action.id, at: action.at, from: "user", kind: "user.choice", choice: "done" }), action.at);
    }

    case "confirm": {
      if (state.phase !== "summary" || state.lines.length === 0) return state;
      return user({ ...state, phase: "saving", error: false }, { id: action.id, at: action.at, from: "user", kind: "user.choice", choice: "confirm" });
    }

    case "saved": {
      if (state.phase !== "saving") return state;
      return mascot({ ...state, phase: "saved", error: false }, action.at, "budgetAssistDone", { amount: action.free });
    }

    case "saveFailed": {
      if (state.phase !== "saving") return state;
      return { ...state, phase: "summary", error: true };
    }
  }
}
