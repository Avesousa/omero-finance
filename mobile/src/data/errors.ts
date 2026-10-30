import type { ErrorReport } from "./types.ts";

export type AppErrorCode =
  // Los que devuelve la API de voz (`VoiceApiError["code"]`).
  | "transcription_failed"
  | "interpretation_failed"
  | "provider_unavailable"
  | "not_configured"
  | "bad_audio"
  | "internal"
  // Los que arma la app.
  | "network"
  | "timeout"
  | "unauthorized"
  | "server"
  | "unknown";

/**
 * Error único de la app. Las pantallas deciden por `retryable` (¿ofrecer reintentar?) y
 * `reported` (¿ya se le avisó al admin?), nunca por el texto del mensaje.
 */
export class AppError extends Error {
  code: AppErrorCode;
  retryable: boolean;
  reported: boolean;
  constructor(message: string, opts: { code?: AppErrorCode; retryable?: boolean; reported?: boolean } = {}) {
    super(message);
    this.name = "AppError";
    this.code = opts.code ?? "unknown";
    this.retryable = opts.retryable ?? false;
    this.reported = opts.reported ?? false;
  }
}

/** Convierte cualquier cosa lanzada en un `AppError`. Red, timeout, 429 y 5xx son reintentables. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "Error desconocido";
  const name = err instanceof Error ? err.name : "";
  if (name === "AbortError" || name === "TimeoutError") return new AppError(message, { code: "timeout", retryable: true });
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === "number") {
    if (status === 0) return new AppError(message, { code: "network", retryable: true });
    if (status === 401) return new AppError(message, { code: "unauthorized" });
    if (status === 429 || status >= 500) return new AppError(message, { code: "server", retryable: true });
    return new AppError(message, { code: "unknown" });
  }
  if (err instanceof TypeError && /network|fetch|failed to|timed? ?out/i.test(message)) {
    return new AppError(message, { code: "network", retryable: true });
  }
  return new AppError(message, { code: "unknown" });
}

/**
 * Avisa al admin (queda registrado en el servidor). Nunca lanza: si no se puede reportar, se ignora.
 * `context` suma datos (qué pantalla, qué se estaba haciendo); no mandar datos sensibles.
 */
export async function reportAppError(
  err: unknown,
  context: Record<string, unknown> = {},
  source: ErrorReport["source"] = "app",
): Promise<void> {
  try {
    const e = toAppError(err);
    const { dataSource } = await import("./sources/index");
    await dataSource.reportError({ source, code: e.code, message: e.message.slice(0, 500), context });
  } catch {
    /* sin red o sin sesión: no hay nada más que hacer */
  }
}
