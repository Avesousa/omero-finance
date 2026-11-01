import { Platform } from "react-native";
import { getInfoAsync, readAsStringAsync } from "expo-file-system/legacy";
import { api, API_URL, getToken } from "../../../lib/api";
import { prefGet } from "../../../lib/storage";
import type { BalanceResponse, InboxItemDTO, PlanData } from "../../../lib/types";
import type { MonthPlan, VoiceApiError, VoiceOutcome } from "../../domain";
import { homeFromPlan } from "../plan.ts";
import { equityRatio, nestStage, wealthTotals } from "../selectors.ts";
import { cardsFromPlan, debtsFromPlan, wealthFromPlan } from "./apiMappers.ts";
import { AppError, toAppError } from "../errors";
import { type DataSource } from "./DataSource";
import type { BudgetItem, EntryKind, EntryPatch, NewEntryInput, NewLoanInput, PendingPayment, VoiceInput } from "../types";

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

/** `GET /api/plan/data` → los campos que usa la app (sin traducir nada: la forma es la misma). */
export function toMonthPlan(data: PlanData): MonthPlan {
  return {
    period: data.period,
    today: data.today,
    started: data.started,
    usdRate: data.usdRate,
    categories: data.categories,
    recurrings: data.recurrings,
    entries: data.entries,
    budgets: data.budgets,
    previousBudgets: data.previousBudgets,
    previousBudgetPeriod: data.previousBudgetPeriod,
    cards: data.cards,
    statements: data.statements,
    purchases: data.purchases,
    loans: data.loans,
  };
}

const fetchPlan = (period?: string) =>
  api<PlanData>("GET", period ? `/api/plan/data?period=${encodeURIComponent(period)}` : "/api/plan/data");

const fetchBalance = async () => (await api<BalanceResponse>("GET", "/api/plan/balance")).items;

/** Capítulo del nido según el patrimonio real; si falla leerlo, arranca en el 1 (Inicio no se rompe por eso). */
async function storyFromBalance(plan: MonthPlan): Promise<{ chapter: 1 | 2 | 3; progress: number }> {
  try {
    const { items } = wealthFromPlan(plan, await fetchBalance());
    const { assets, debts } = wealthTotals(items, plan.usdRate);
    const { chapter, progress } = nestStage(equityRatio(assets, debts));
    return { chapter, progress };
  } catch {
    return { chapter: 1, progress: 0 };
  }
}

/** Primer nombre del usuario guardado en el login ("Avelino Sousa" → "Avelino"); vacío si no hay. */
async function savedFirstName(): Promise<string> {
  try {
    const raw = await prefGet("omero_user");
    const name = raw ? (JSON.parse(raw) as { name?: string }).name : "";
    return name?.trim().split(/\s+/)[0] ?? "";
  } catch {
    return "";
  }
}

/**
 * Fuente real: todo sale de la misma API que usa la web (`/api/plan/data`, `/balance`, `/inbox`, `/loans`…).
 * Las metas del nido todavía no existen en el backend (Patrimonio las oculta).
 */
export const apiSource: DataSource = {
  // Inicio se deriva del plan del mes (misma cuenta que la web). La historia del nido todavía no tiene
  // patrimonio real en api (getWealth no está), así que arranca en el capítulo 1.
  getHome: async (period?: string) => {
    const data = await fetchPlan(period);
    const plan = toMonthPlan(data);
    return homeFromPlan(plan, {
      greetingName: await savedFirstName(),
      pendingConfirmCount: data.inboxPendingCount,
      story: await storyFromBalance(plan),
    });
  },
  getPlan: async (period?: string) => toMonthPlan(await fetchPlan(period)),
  saveBudget: async (period: string, items: BudgetItem[]) => {
    await api("PUT", "/api/plan/budget", { period, items });
  },
  getPendingPayments: async () => {
    const res = await api<{ items: InboxItemDTO[] }>("GET", "/api/plan/inbox");
    return res.items.map(toPending);
  },
  getNotifications: async () => {
    const res = await api<{ items: InboxItemDTO[] }>("GET", "/api/plan/inbox");
    return { pending: res.items.map(toPending), notices: [] };
  },
  confirmPayment: async (id: string, amount?: number) => {
    // Se confirma con lo que la web ya sugiere (categoría, débito o tarjeta); la app solo puede completar el monto.
    const res = await api<{ items: InboxItemDTO[] }>("GET", "/api/plan/inbox");
    const item = res.items.find((i) => i.id === id);
    if (!item) throw new AppError("Ese pago ya no está pendiente.", { code: "internal" });
    const value = amount ?? item.amount;
    if (!value || value <= 0) throw new AppError("Falta el monto del pago.", { code: "internal" });
    const useCard = item.suggestedMethod === "CARD" && !!item.suggestedCardId;
    await api("POST", `/api/plan/inbox/${id}/confirm`, {
      amount: value,
      currency: item.currency,
      categoryId: item.suggestedCategoryId,
      date: item.occurredAt.slice(0, 10),
      name: item.merchant ?? undefined,
      method: useCard ? "CARD" : "DEBIT",
      ...(useCard ? { cardId: item.suggestedCardId } : {}),
    });
  },
  getCards: async (period?: string) => cardsFromPlan(toMonthPlan(await fetchPlan(period))),
  getWealth: async (period?: string) => {
    const [data, balance] = await Promise.all([fetchPlan(period), fetchBalance()]);
    return wealthFromPlan(toMonthPlan(data), balance);
  },
  markStatementPaid: async (cardId: string, period: string) => {
    const plan = toMonthPlan(await fetchPlan(period));
    const statement = plan.statements.find((st) => st.cardId === cardId && st.period === period);
    if (!statement) throw new AppError("Todavía no hay un resumen cargado para ese mes.", { code: "internal" });
    await api("PATCH", `/api/plan/card-statements/${statement.id}`, { isPaid: true });
  },
  getDebts: async (period?: string) => debtsFromPlan(toMonthPlan(await fetchPlan(period))),
  markLoanPaid: async (loanId: string, period: string) => {
    const plan = toMonthPlan(await fetchPlan(period));
    const payment = plan.loans.find((l) => l.id === loanId)?.payments.find((p) => p.period === period);
    if (!payment) throw new AppError("Esa cuota todavía no existe: iniciá el mes en la web.", { code: "internal" });
    await api("PATCH", `/api/plan/entries/${payment.entryId}`, { isDone: true });
  },
  addLoan: async (input: NewLoanInput) => {
    const created = await api<{ id: string }>("POST", "/api/plan/loans", {
      direction: input.direction,
      mode: input.mode,
      name: input.name,
      counterpart: input.counterpart,
      currency: input.currency,
      principal: input.principal,
      installments: input.installments,
      installmentAmount: input.installmentAmount,
      interestRate: input.interestRate,
      interestAnnual: input.interestAnnual,
      interestTaxPct: input.interestTaxPct,
      startPeriod: input.startPeriod,
      dueDay: input.dueDay,
      endDate: input.endDate,
    });
    const plan = toMonthPlan(await fetchPlan());
    const loan = plan.loans.find((l) => l.id === created.id);
    if (!loan) throw new AppError("El préstamo se guardó pero no pude leerlo; actualizá la pantalla.", { code: "internal" });
    return loan;
  },
  interpretVoice: postVoice,
  getCategories: async (kind: EntryKind) => {
    const data = await fetchPlan();
    return data.categories
      // Las de sistema (ej. "Tarjetas de crédito") se arman solas: no se eligen al cargar.
      .filter((c) => c.kind === kind && !c.isArchived && !c.systemKey)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({ id: c.id, name: c.name }));
  },
  addEntry: async (input: NewEntryInput) => {
    await api("POST", "/api/plan/entries", {
      kind: input.kind,
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
  updateEntry: async (id: string, patch: EntryPatch) => {
    await api("PATCH", `/api/plan/entries/${encodeURIComponent(id)}`, patch);
  },
  deleteEntry: async (id: string, scope: "month" | "rule") => {
    await api("DELETE", `/api/plan/entries/${encodeURIComponent(id)}${scope === "rule" ? "?scope=rule" : ""}`);
  },
  reportError: async (report) => {
    await api("POST", "/api/plan/errors", report);
  },
};
