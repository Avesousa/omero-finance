import { secureGet, secureSet } from "./storage";

/** URL de la web de Omero (el backend), sin barra final. Se define en mobile/.env. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

const TOKEN_KEY = "omero_token";
let token: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

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
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    throw new ApiError(message, res.status);
  }
  return json as T;
}
