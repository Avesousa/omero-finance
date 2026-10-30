import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from "expo-audio";

/** Estado del micrófono: `denied` = el usuario negó el permiso; `unavailable` = este dispositivo/navegador no graba. */
export type RecorderStatus = "idle" | "recording" | "denied" | "unavailable";

export type StartResult = "started" | "denied" | "unavailable";

export interface RecordedAudio {
  uri: string;
  mimeType: string;
  durationMs: number;
}

/** Preset de voz: m4a/aac mono a 16 kHz (liviano y lo que mejor transcribe). En web, webm. */
const VOICE_OPTIONS: RecordingOptions = {
  extension: ".m4a",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
  android: { outputFormat: "mpeg4", audioEncoder: "aac" },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: 64, // AudioQuality.MEDIUM
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: "audio/webm", bitsPerSecond: 32000 },
};

const MIME_TYPE = Platform.OS === "web" ? "audio/webm" : "audio/m4a";
/** Por debajo de esto no hay nada que transcribir: se descarta como un toque accidental. */
const MIN_DURATION_MS = 400;
/** Tope de grabación (el servidor rechaza audios de más de 10 MB; esto queda muy por debajo). */
export const MAX_RECORDING_MS = 90_000;

/**
 * Graba la voz con `expo-audio`.
 * `start()` pide el permiso y dice cómo salió (`denied` si se niega; `status` también queda en `denied`), `stop()` devuelve el archivo
 * (o `null` si fue demasiado corto o falló) y `cancel()` descarta lo grabado.
 * `level` va de 0 a 1 (nivel del micrófono) para animar la UI.
 */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(VOICE_OPTIONS);
  const state = useAudioRecorderState(recorder, 150);
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef(0);
  const active = useRef(false);

  // Reloj propio: el estado del grabador puede demorar en web.
  useEffect(() => {
    if (status !== "recording") return;
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt.current), 200);
    return () => clearInterval(id);
  }, [status]);

  const release = useCallback(async () => {
    active.current = false;
    try {
      await setAudioModeAsync({ allowsRecording: false });
    } catch {
      /* no pasa nada si no se puede soltar la sesión de audio */
    }
  }, []);

  const start = useCallback(async (): Promise<StartResult> => {
    if (active.current) return "started";
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setStatus("denied");
        return "denied";
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      active.current = true;
      startedAt.current = Date.now();
      setElapsedMs(0);
      setStatus("recording");
      return "started";
    } catch {
      await release();
      setStatus("unavailable");
      return "unavailable";
    }
  }, [recorder, release]);

  const stop = useCallback(async (): Promise<RecordedAudio | null> => {
    if (!active.current) return null;
    const durationMs = Date.now() - startedAt.current;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      await release();
      setStatus("idle");
      setElapsedMs(0);
      if (!uri || durationMs < MIN_DURATION_MS) return null;
      return { uri, mimeType: MIME_TYPE, durationMs };
    } catch {
      await release();
      setStatus("unavailable");
      return null;
    }
  }, [recorder, release]);

  const cancel = useCallback(async () => {
    if (!active.current) return;
    try {
      await recorder.stop();
    } catch {
      /* ya estaba detenido */
    }
    await release();
    setStatus("idle");
    setElapsedMs(0);
  }, [recorder, release]);

  // Si la pantalla se cierra grabando, se suelta el micrófono.
  useEffect(
    () => () => {
      if (active.current) {
        try {
          void recorder.stop();
        } catch {
          /* nada que hacer */
        }
        active.current = false;
      }
    },
    [recorder],
  );

  // dB (-60 silencio … 0 fuerte) → 0..1
  const metering = state.metering;
  const level = status === "recording" && typeof metering === "number" ? Math.min(1, Math.max(0, (metering + 60) / 60)) : 0;

  return { status, elapsedMs, level, start, stop, cancel };
}
