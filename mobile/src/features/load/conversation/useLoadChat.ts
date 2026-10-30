import { useCallback, useEffect, useRef } from "react";
import { router } from "expo-router";
import { toAppError, useInterpretVoice, type VoiceInput } from "../../../data";
import type { MascotMoment } from "../../../mascots/types";
import type { RecordedAudio } from "../useVoiceRecorder";
import { conversation, useLoadConversation } from "./store";
import type { ManualKind } from "./types";

/** Cuánto se ve a la mascota decir que armó el borrador antes de abrir el formulario. */
export const DRAFT_OPEN_DELAY_MS = 900;

const MANUAL_ROUTES: Partial<Record<ManualKind, string>> = {
  income: "/ingresos/nuevo",
  debt: "/deudas/nueva",
};

/**
 * Orquesta el chat de Cargar: manda lo que escribís o grabás a interpretar y deja la respuesta en el hilo.
 * Monta el hilo (saludo) y lo reinicia al desmontarse la pantalla. Una sola interpretación a la vez (`busy`).
 */
export function useLoadChat() {
  const { messages, dispatch } = useLoadConversation();
  const interpret = useInterpretVoice();
  const busy = useRef(false);
  const inputs = useRef(new Map<string, VoiceInput>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    dispatch({ type: "start" });
    return () => {
      if (timer.current) clearTimeout(timer.current);
      inputs.current.clear();
      dispatch({ type: "reset" });
    };
  }, [dispatch]);

  /** Abre el formulario con el borrador; el hilo queda detrás. */
  const openDraft = useCallback((draftId: string) => {
    const msg = conversation.getState().messages.find((m) => m.kind === "mascot.draft" && m.draftId === draftId);
    if (!msg || msg.kind !== "mascot.draft") return;
    router.push({
      pathname: "/ingresos/nuevo",
      params: { draft: JSON.stringify(msg.draft), transcript: msg.transcript, draftId },
    });
  }, []);

  const run = useCallback(
    async (messageId: string, input: VoiceInput, retry: boolean) => {
      if (busy.current) return;
      busy.current = true;
      dispatch(retry ? { type: "thinking", forMessageId: messageId } : { type: "thinking" });
      try {
        const outcome = await interpret.mutateAsync(input);
        const draftId = conversation.newId("d");
        dispatch({ type: "outcome", outcome, forMessageId: messageId, draftId });
        if (outcome.kind === "draft") {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            const d = conversation.getState().messages.find((m) => m.kind === "mascot.draft" && m.draftId === draftId);
            if (d && d.kind === "mascot.draft" && d.status === "pending") openDraft(draftId);
          }, DRAFT_OPEN_DELAY_MS);
        }
      } catch (e) {
        dispatch({ type: "error", error: toAppError(e), forMessageId: messageId });
      } finally {
        busy.current = false;
      }
    },
    [dispatch, interpret, openDraft],
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

  /** Opción de carga manual (sin borrador). Los tipos sin pantalla todavía no hacen nada. */
  const openManual = useCallback((kind: ManualKind) => {
    // A mano no hay borrador que seguir en el chat: el formulario reemplaza a Cargar y al
    // guardar se vuelve a la app (como antes). Lo dictado sí vuelve al chat (ver openDraft).
    const href = MANUAL_ROUTES[kind];
    if (href) router.replace(href as never);
  }, []);

  /** La mascota dice un momento suelto (p. ej. `voicePermission`, `voiceUnclear` si el audio fue muy corto). */
  const say = useCallback((moment: MascotMoment) => dispatch({ type: "say", moment }), [dispatch]);

  return { messages, busy: interpret.isPending, sendText, sendAudio, retry, openDraft, openManual, say };
}
