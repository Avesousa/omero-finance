import { useCallback } from "react";
import { AppState, Platform } from "react-native";
import { focusManager, QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dataSource, DATA_SOURCE } from "./sources";
import { notificationBadgeCount } from "./selectors";

export { DATA_SOURCE } from "./sources";
export * from "./types";
export * from "./selectors";

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

export const isMockData = DATA_SOURCE === "mock";
