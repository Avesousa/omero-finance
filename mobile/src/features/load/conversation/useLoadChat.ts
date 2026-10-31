import { useCallback, useEffect, useRef } from "react";
import { router } from "expo-router";
import { toAppError, useAddEntry, useCategories, useInterpretVoice, type VoiceInput } from "../../../data";
import { formatMoney } from "../../../i18n/format";
import type { MascotMoment } from "../../../mascots/types";
import type { RecordedAudio } from "../useVoiceRecorder";
import { conversation, useLoadConversation } from "./store";
import { draftToEntryInput } from "./draft";
import type { ManualKind } from "./types";

const MANUAL_ROUTES: Partial<Record<ManualKind, string>> = {
  income: "/ingresos/nuevo",
  expense: "/gastos/nuevo",
  debt: "/deudas/nueva",
};

/** Marca de que el formulario se abrió desde el chat: al guardar vuelve (`router.back()`) y la mascota lo cuenta. */
const FROM_CHAT = { chatRef: "1" };

/** El borrador de la conversación, solo si sigue esperando Confirmar/Editar. */
function findPending(draftId: string) {
  const msg = conversation.getState().messages.find((m) => m.kind === "mascot.draft" && m.draftId === draftId);
  return msg && msg.kind === "mascot.draft" && msg.status === "pending" ? msg : null;
}

/**
 * Orquesta el chat de Cargar: manda lo que escribís o grabás a interpretar y deja la respuesta en el hilo.
 * Monta el hilo (saludo) y lo reinicia al desmontarse la pantalla. Una sola interpretación a la vez (`busy`).
 * Lo que arma la mascota queda como tarjeta (Confirmar / Editar): nunca abre el formulario sola.
 * Los formularios se apilan arriba de Cargar (`router.push`), así el hilo sigue montado detrás.
 */
export function useLoadChat() {
  const { messages, dispatch } = useLoadConversation();
  const interpret = useInterpretVoice();
  const busy = useRef(false);
  const inputs = useRef(new Map<string, VoiceInput>());
  const addEntry = useAddEntry();
  const incomeCategories = useCategories("INCOME");
  const expenseCategories = useCategories("EXPENSE");

  useEffect(() => {
    dispatch({ type: "start" });
    return () => {
      inputs.current.clear();
      dispatch({ type: "reset" });
    };
  }, [dispatch]);

  /** Editar: abre el formulario del tipo correcto arriba del chat, precargado con el borrador. */
  const editDraft = useCallback((draftId: string) => {
    const msg = findPending(draftId);
    if (!msg) return;
    router.push({
      pathname: msg.draft.kind === "EXPENSE" ? "/gastos/nuevo" : "/ingresos/nuevo",
      params: {
        ...FROM_CHAT,
        draft: JSON.stringify(msg.draft),
        draftId,
        source: msg.source,
        ...(msg.transcript ? { transcript: msg.transcript } : {}),
      },
    });
  }, []);

  /** Confirmar: guarda directo si la información está completa; si falta algo, abre el formulario. */
  const confirmDraft = useCallback(
    async (draftId: string) => {
      const msg = findPending(draftId);
      if (!msg) return;
      const categories = msg.intent === "income" ? incomeCategories.data : expenseCategories.data;
      const input = draftToEntryInput(msg.draft, categories?.find((c) => c.id === msg.draft.categoryId)?.name);
      if (!input) {
        editDraft(draftId);
        return;
      }
      dispatch({ type: "draftSaving", draftId });
      try {
        await addEntry.mutateAsync(input);
        dispatch({ type: "draftSaved", draftId, amount: formatMoney(input.amount, input.currency) });
      } catch {
        dispatch({ type: "draftFailed", draftId });
      }
    },
    [addEntry, dispatch, editDraft, expenseCategories.data, incomeCategories.data],
  );

  const run = useCallback(
    async (messageId: string, input: VoiceInput, retry: boolean) => {
      if (busy.current) return;
      busy.current = true;
      dispatch(retry ? { type: "thinking", forMessageId: messageId } : { type: "thinking" });
      try {
        const outcome = await interpret.mutateAsync(input);
        dispatch({ type: "outcome", outcome, forMessageId: messageId, draftId: conversation.newId("d") });
      } catch (e) {
        dispatch({ type: "error", error: toAppError(e), forMessageId: messageId });
      } finally {
        busy.current = false;
      }
    },
    [dispatch, interpret],
  );

  const sendText = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value || busy.current) return;
      const id = conversation.newId();
      const input: VoiceInput = { text: value };
      inputs.current.set(id, input);
      dispatch({ type: "userText", id, text: value });
      void run(id, input, false);
    },
    [dispatch, run],
  );

  const sendAudio = useCallback(
    (audio: RecordedAudio) => {
      if (busy.current) return;
      const id = conversation.newId();
      const input: VoiceInput = { audioUri: audio.uri, mimeType: audio.mimeType, durationMs: audio.durationMs };
      inputs.current.set(id, input);
      dispatch({ type: "userAudio", id, uri: audio.uri, durationMs: audio.durationMs, waveform: audio.waveform });
      void run(id, input, false);
    },
    [dispatch, run],
  );

  /** Reenvía lo mismo del mensaje del usuario `messageId` (el `retryOf` de un `mascot.error`). */
  const retry = useCallback(
    (messageId: string) => {
      const input = inputs.current.get(messageId);
      if (input) void run(messageId, input, true);
    },
    [run],
  );

  /** Opción de carga manual (sin borrador): el formulario se abre arriba del chat y al guardar vuelve a él. */
  const openManual = useCallback((kind: ManualKind) => {
    const href = MANUAL_ROUTES[kind];
    if (href) router.push({ pathname: href, params: FROM_CHAT } as never);
  }, []);

  /** La mascota dice un momento suelto (p. ej. `voicePermission`, `voiceUnclear` si el audio fue muy corto). */
  const say = useCallback((moment: MascotMoment) => dispatch({ type: "say", moment }), [dispatch]);

  return { messages, busy: interpret.isPending, sendText, sendAudio, retry, confirmDraft, editDraft, openManual, say };
}
