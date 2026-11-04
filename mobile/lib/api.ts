import { secureGet, secureSet } from "./storage";
import { isCurrentFinanceRequest } from "./finance-selection";

/** URL de la web de Omero (el backend), sin barra final. Se define en mobile/.env. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

const TOKEN_KEY = "omero_token";
let token: string | null = null;
let unauthorizedHandler: (() => void) | null = null;
let activeFinanceId: string | null = null;
let financeDeniedHandler: (() => void) | null = null;

/** Finanza activa: se manda como `x-finance-id`. El servidor la valida en cada pedido. */
export function setActiveFinanceId(id: string | null): void {
  if (id === activeFinanceId) return;
  activeFinanceId = id;
  for (const listener of financeListeners) listener();
}

const financeListeners = new Set<() => void>();

/** Avisa cuando cambia la finanza activa (para que las consultas recalculen su clave). Devuelve la baja. */
export function subscribeActiveFinance(listener: () => void): () => void {
  financeListeners.add(listener);
  return () => financeListeners.delete(listener);
}

export function getActiveFinanceId(): string | null {
  return activeFinanceId;
}

/** Lo llama el proveedor de finanzas para volver a Personal cuando el servidor responde "No tenés acceso a esa finanza". */
export function onFinanceDenied(handler: (() => void) | null): void {
  financeDeniedHandler = handler;
}

const FINANCE_DENIED = "No tenés acceso a esa finanza";

export async function loadToken(): Promise<string | null> {
  token = await secureGet(TOKEN_KEY);
  return token;
}

export async function setToken(next: string | null): Promise<void> {
  token = next;
  await secureSet(TOKEN_KEY, next);
}

export function getToken(): string | null {
  return token;
}

/** Lo llama el proveedor de sesión para volver al login cuando el servidor responde 401. */
export function onUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  if (!API_URL) throw new ApiError("Falta configurar EXPO_PUBLIC_API_URL (mirá mobile/.env.example).", 0);
  const requestedFinanceId = activeFinanceId;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(requestedFinanceId ? { "x-finance-id": requestedFinanceId } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("No pude conectarme. Revisá tu conexión e intentá de nuevo.", 0);
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* sin cuerpo */
  }

  if (!res.ok) {
    const message = (json as { error?: string } | null)?.error ?? "Algo salió mal. Intentá de nuevo.";
    // 401 fuera del login = sesión vencida. En el login es "credenciales inválidas".
    if (res.status === 401 && path !== "/api/auth/login") {
      await setToken(null);
      unauthorizedHandler?.();
    }
    if (res.status === 403 && message.startsWith(FINANCE_DENIED) && isCurrentFinanceRequest(requestedFinanceId, activeFinanceId)) {
      financeDeniedHandler?.();
    }
    throw new ApiError(message, res.status);
  }
  return json as T;
}
