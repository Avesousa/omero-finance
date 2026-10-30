import type { DataSource } from "./DataSource";
import { apiSource } from "./api";
import { mockSource } from "./mock";

export type DataSourceKind = "mock" | "api";

/** `EXPO_PUBLIC_DATA_SOURCE=api` usa el backend; cualquier otra cosa (o nada) usa mock. */
export const DATA_SOURCE: DataSourceKind = process.env.EXPO_PUBLIC_DATA_SOURCE === "api" ? "api" : "mock";

/**
 * `EXPO_PUBLIC_VOICE_SOURCE=api|mock` elige de dónde sale la voz (`interpretVoice` y `reportError`).
 * Si falta o es otra cosa, sigue a `DATA_SOURCE`. Con datos `mock` + voz `api` se prueba la voz real
 * (OpenAI) sin escribir nada en la base: todo lo demás, incluido `addIncome`, queda en mock.
 */
export const VOICE_SOURCE: DataSourceKind =
  process.env.EXPO_PUBLIC_VOICE_SOURCE === "api" ? "api"
  : process.env.EXPO_PUBLIC_VOICE_SOURCE === "mock" ? "mock"
  : DATA_SOURCE;

/** La API pide sesión: se exige login si los datos o la voz van a la API. */
export const REQUIRES_LOGIN: boolean = DATA_SOURCE === "api" || VOICE_SOURCE === "api";

function build(): DataSource {
  if (DATA_SOURCE === VOICE_SOURCE) return DATA_SOURCE === "api" ? apiSource : mockSource;
  const base = DATA_SOURCE === "api" ? apiSource : mockSource;
  const voice = VOICE_SOURCE === "api" ? apiSource : mockSource;
  return { ...base, interpretVoice: voice.interpretVoice, reportError: voice.reportError };
}

export const dataSource: DataSource = build();
export type { DataSource } from "./DataSource";
