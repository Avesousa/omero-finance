import { useCallback } from "react";
import { AppState, Platform } from "react-native";
import { focusManager, QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { VoiceOutcome } from "../domain";
import { dataSource, DATA_SOURCE } from "./sources";
import { notificationBadgeCount } from "./selectors";
import { AppError, reportAppError, toAppError } from "./errors";
import type { EntryKind, NewEntryInput, NewLoanInput, VoiceInput } from "./types";

export { DATA_SOURCE, VOICE_SOURCE, REQUIRES_LOGIN } from "./sources";
export * from "./types";
export * from "./selectors";
export { AppError, reportAppError, toAppError } from "./errors";
export type { AppErrorCode } from "./errors";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: true } },
});

// En el teléfono, "volver a la app" es AppState, no el foco de una ventana.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (status) => focusManager.setFocused(status === "active"));
}

export const queryKeys = {
  home: (period?: string) => ["home", period ?? "current"] as const,
  pending: ["pending-payments"] as const,
  notifications: ["notifications"] as const,
  cards: (period?: string) => ["cards", period ?? "current"] as const,
  wealth: (period?: string) => ["wealth", period ?? "current"] as const,
  debts: (period?: string) => ["debts", period ?? "current"] as const,
  categories: (kind: EntryKind) => ["categories", kind] as const,
};

/** Resumen del mes para Inicio. */
export function useHome(period?: string) {
  return useQuery({ queryKey: queryKeys.home(period), queryFn: () => dataSource.getHome(period) });
}

/** Pagos de Apple Pay por confirmar. */
export function usePendingPayments() {
  return useQuery({ queryKey: queryKeys.pending, queryFn: () => dataSource.getPendingPayments() });
}

/** `{ pending, notices }` para la pantalla Notificaciones. */
export function useNotifications() {
  return useQuery({ queryKey: queryKeys.notifications, queryFn: () => dataSource.getNotifications() });
}

/** Número del globo de la campana (pendientes + avisos sin leer). 0 mientras carga. */
export function useNotificationBadge(): number {
  const { data } = useNotifications();
  return data ? notificationBadgeCount(data.pending, data.notices) : 0;
}

/** Mutación: confirmar un pago por confirmar. Refresca home, pendientes y notificaciones. */
export function useConfirmPayment() {
  const qc = useQueryClient();
  const refresh = useCallback(
    () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["home"] }),
        qc.invalidateQueries({ queryKey: queryKeys.pending }),
        qc.invalidateQueries({ queryKey: queryKeys.notifications }),
      ]),
    [qc],
  );
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount?: number }) => dataSource.confirmPayment(id, amount),
    onSuccess: refresh,
  });
}

/** Tarjetas del mes: resúmenes, vencimientos y cuotas. */
export function useCards(period?: string) {
  return useQuery({ queryKey: queryKeys.cards(period), queryFn: () => dataSource.getCards(period) });
}

/** Patrimonio del mes: activos, deudas e historial. */
export function useWealth(period?: string) {
  return useQuery({ queryKey: queryKeys.wealth(period), queryFn: () => dataSource.getWealth(period) });
}

/** Mutación: marcar pagado el resumen de una tarjeta. Refresca tarjetas, patrimonio e Inicio. */
export function useMarkStatementPaid() {
  const qc = useQueryClient();
  const refresh = useCallback(
    () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["cards"] }),
        qc.invalidateQueries({ queryKey: ["wealth"] }),
        qc.invalidateQueries({ queryKey: ["home"] }),
      ]),
    [qc],
  );
  return useMutation({
    mutationFn: ({ cardId, period }: { cardId: string; period: string }) => dataSource.markStatementPaid(cardId, period),
    onSuccess: refresh,
  });
}

/** Deudas del mes: préstamos (debo / me deben) y deuda de tarjetas. Usar `loanRow`/`debtsTotals` para mostrar. */
export function useDebts(period?: string) {
  return useQuery({ queryKey: queryKeys.debts(period), queryFn: () => dataSource.getDebts(period) });
}

function useRefreshDebts() {
  const qc = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["debts"] }),
        qc.invalidateQueries({ queryKey: ["wealth"] }),
        qc.invalidateQueries({ queryKey: ["home"] }),
      ]),
    [qc],
  );
}

/** Mutación: marcar pagada/cobrada la cuota de un préstamo en un período. Refresca deudas, patrimonio e Inicio. */
export function useMarkLoanPaid() {
  const refresh = useRefreshDebts();
  return useMutation({
    mutationFn: ({ loanId, period }: { loanId: string; period: string }) => dataSource.markLoanPaid(loanId, period),
    onSuccess: refresh,
  });
}

/** Mutación: agregar un préstamo (`NewLoanInput`). Refresca deudas, patrimonio e Inicio. */
export function useAddLoan() {
  const refresh = useRefreshDebts();
  return useMutation({
    mutationFn: (input: NewLoanInput) => dataSource.addLoan(input),
    onSuccess: refresh,
  });
}

/** Categorías del hogar de un tipo (chips del formulario de ingreso o gasto). */
export function useCategories(kind: EntryKind) {
  return useQuery({ queryKey: queryKeys.categories(kind), queryFn: () => dataSource.getCategories(kind) });
}

/** Mutación: agregar un ingreso o un gasto (`NewEntryInput`). Refresca Inicio y Patrimonio. */
export function useAddEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewEntryInput) => dataSource.addEntry(input),
    onSuccess: () =>
      Promise.all([qc.invalidateQueries({ queryKey: ["home"] }), qc.invalidateQueries({ queryKey: ["wealth"] })]),
  });
}

/**
 * Mutación: interpreta lo dicho (audio o texto) → `VoiceOutcome`. No guarda nada.
 * Reintenta sola hasta 2 veces (800 ms, 1,6 s) si el error es `retryable`; los errores llegan como `AppError`.
 * Si termina fallando y el servidor no lo registró (`reported` false), lo reporta al admin
 * (salvo `bad_audio`, que es del usuario: la pantalla lo trata como "no entendí").
 * Para "Reintentar": `mutate(mismoInput)`.
 */
export function useInterpretVoice() {
  return useMutation<VoiceOutcome, AppError, VoiceInput>({
    mutationFn: async (input) => {
      try {
        return await dataSource.interpretVoice(input);
      } catch (e) {
        throw toAppError(e);
      }
    },
    retry: (failureCount, error) => error.retryable && failureCount < 2,
    retryDelay: (attempt) => 800 * 2 ** attempt,
    onError: (error) => {
      if (!error.reported && error.code !== "bad_audio") {
        void reportAppError(error, { feature: "voice" }, "voice");
      }
    },
  });
}

export const isMockData = DATA_SOURCE === "mock";
