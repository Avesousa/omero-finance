/**
 * Registro de errores para el admin (carga por voz, app móvil). Solo servidor.
 * Además de guardar en la base, hace console.error para que llegue a los logs de Vercel.
 */

import { prisma } from "@/lib/prisma";

export interface ErrorReportInput {
  householdId?: string | null;
  userId?: string | null;
  /** "voice" | "app" */
  source: string;
  code: string;
  message: string;
  context?: unknown;
}

const clip = (s: unknown, max: number) => String(s ?? "").trim().slice(0, max);

/** Deja el contexto como objeto JSON chico, o null. */
export function sanitizeContext(context: unknown): Record<string, unknown> | null {
  if (!context || typeof context !== "object" || Array.isArray(context)) return null;
  try {
    const json = JSON.stringify(context);
    if (json.length > 4000) return { truncated: json.slice(0, 3900) };
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Registra un error. Nunca lanza: devuelve true si quedó guardado en la base. */
export async function reportError(input: ErrorReportInput): Promise<boolean> {
  const source = clip(input.source, 40) || "app";
  const code = clip(input.code, 80) || "unknown";
  const message = clip(input.message, 1000) || "(sin mensaje)";
  console.error(`[error-report ${source}/${code}]`, message);
  try {
    await prisma.appErrorReport.create({
      data: {
        householdId: input.householdId ?? null,
        userId: input.userId ?? null,
        source, code, message,
        context: (sanitizeContext(input.context) ?? undefined) as never,
      },
    });
    return true;
  } catch (err) {
    console.error("[error-report] no se pudo guardar", err);
    return false;
  }
}
