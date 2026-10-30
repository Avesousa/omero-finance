import { Platform } from "react-native";
import { getInfoAsync, readAsStringAsync } from "expo-file-system/legacy";
import { api, API_URL, getToken } from "../../../lib/api";
import type { InboxItemDTO, PlanData } from "../../../lib/types";
import type { VoiceApiError, VoiceOutcome } from "../../domain";
import { AppError, toAppError } from "../errors";
import { NotImplementedError, type DataSource } from "./DataSource";
import type { NewIncomeInput, PendingPayment, VoiceInput } from "../types";

const VOICE_TIMEOUT_MS = 45_000;

/** Lee el audio grabado como base64 + tamaño en bytes. Falla con `bad_audio` si no existe o está vacío. */
async function readAudio(uri: string): Promise<{ base64: string; bytes: number }> {
  const bad = () => new AppError("No pude leer el audio grabado.", { code: "bad_audio" });
  try {
    if (Platform.OS === "web") {
      const blob = await fetch(uri).then((r) => r.blob());
      if (!blob.size) throw bad();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), bytes: blob.size };
    }
    const info = await getInfoAsync(uri);
    if (!info.exists || !("size" in info) || !info.size) throw bad();
    const base64 = await readAsStringAsync(uri, { encoding: "base64" });
    if (!base64) throw bad();
    return { base64, bytes: info.size };
  } catch (e) {
    throw e instanceof AppError ? e : bad();
  }
}

function logVoiceError(e: unknown, extra: { status?: number; audioBytes?: number; durationMs?: number }) {
  if (!__DEV__) return;
  const err = e as { code?: string; message?: string };
  // Nunca se loguea el token ni el base64.
  console.warn("[voz]", { ...extra, code: err?.code, message: err?.message });
}

/**
 * `POST /api/plan/voice`. No usa `api()` porque necesita los campos `code/retryable/reported`
 * del error, que `api()` descarta. El audio viaja como JSON base64 (el FormData con `{ uri }`
 * no se sube bien con el `fetch` de `expo/fetch` del SDK 58).
 */
async function postVoice(input: VoiceInput): Promise<VoiceOutcome> {
  const meta: { status?: number; audioBytes?: number; durationMs?: number } = {};
  try {
    return await postVoiceInner(input, meta);
  } catch (e) {
    logVoiceError(e, meta);
    throw e;
  }
}

async function postVoiceInner(
  input: VoiceInput,
  meta: { status?: number; audioBytes?: number; durationMs?: number },
): Promise<VoiceOutcome> {
  if (!API_URL) throw new AppError("Falta configurar EXPO_PUBLIC_API_URL.", { code: "internal" });
  const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: string;
  if ("text" in input) {
    body = JSON.stringify({ text: input.text });
  } else {
    if ("durationMs" in input && typeof input.durationMs === "number") meta.durationMs = input.durationMs;
    const audio = await readAudio(input.audioUri);
    meta.audioBytes = audio.bytes;
    body = JSON.stringify({ audio: { base64: audio.base64, mimeType: input.mimeType, name: "voz.m4a" } });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VOICE_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/plan/voice`, { method: "POST", headers, body, signal: controller.signal });
  } catch (e) {
    throw toAppError(
      (e as Error)?.name === "AbortError"
        ? e
        : Object.assign(new Error("No pude conectarme. Revisá tu conexión."), { status: 0 }),
    );
  } finally {
    clearTimeout(timer);
  }
  meta.status = res.status;

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* sin cuerpo */
  }

  if (res.ok) {
    const outcome = (json as { outcome?: VoiceOutcome } | null)?.outcome;
    if (!outcome) throw new AppError("Respuesta inesperada del servidor.", { code: "internal" });
    return outcome;
  }
  if (res.status === 401) throw new AppError("Tu sesión venció. Volvé a entrar.", { code: "unauthorized" });
  const err = json as Partial<VoiceApiError> | null;
  throw new AppError(err?.error ?? "Algo salió mal. Intentá de nuevo.", {
    code: err?.code ?? (res.status >= 500 ? "server" : "unknown"),
    retryable: err?.retryable ?? (res.status === 429 || res.status === 503),
    reported: err?.reported ?? false,
  });
}

function toPending(item: InboxItemDTO): PendingPayment {
  return {
    id: item.id,
    merchant: item.merchant ?? "",
    amount: item.amount,
    currency: item.currency,
    card: item.walletCard,
    occurredAt: item.occurredAt.slice(0, 16),
  };
}

/**
 * Fuente real. Solo los pagos por confirmar existen hoy en el backend (`/api/plan/inbox`);
 * el resto lanza NotImplementedError hasta que se conecte.
 */
export const apiSource: DataSource = {
  getHome: async () => {
    throw new NotImplementedError("getHome");
  },
  getPendingPayments: async () => {
    const res = await api<{ items: InboxItemDTO[] }>("GET", "/api/plan/inbox");
    return res.items.map(toPending);
  },
  getNotifications: async () => {
    const res = await api<{ items: InboxItemDTO[] }>("GET", "/api/plan/inbox");
    return { pending: res.items.map(toPending), notices: [] };
  },
  confirmPayment: async () => {
    throw new NotImplementedError("confirmPayment");
  },
  getCards: async () => {
    throw new NotImplementedError("getCards");
  },
  getWealth: async () => {
    throw new NotImplementedError("getWealth");
  },
  markStatementPaid: async () => {
    throw new NotImplementedError("markStatementPaid");
  },
  getDebts: async () => {
    throw new NotImplementedError("getDebts");
  },
  markLoanPaid: async () => {
    throw new NotImplementedError("markLoanPaid");
  },
  addLoan: async () => {
    throw new NotImplementedError("addLoan");
  },
  interpretVoice: postVoice,
  getIncomeCategories: async () => {
    const data = await api<PlanData>("GET", "/api/plan/data");
    return data.categories
      .filter((c) => c.kind === "INCOME" && !c.isArchived)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({ id: c.id, name: c.name }));
  },
  addIncome: async (input: NewIncomeInput) => {
    await api("POST", "/api/plan/entries", {
      kind: "INCOME",
      period: input.period,
      name: input.name,
      amount: input.amount,
      currency: input.currency,
      categoryId: input.categoryId,
      date: input.date,
      note: input.note,
      ...(input.fixed ? { fixed: input.fixed } : {}),
    });
  },
  reportError: async (report) => {
    await api("POST", "/api/plan/errors", report);
  },
};
