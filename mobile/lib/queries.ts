import { useCallback } from "react";
import { AppState, Platform } from "react-native";
import { focusManager, QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { api } from "./api";
import type { InboxItemDTO, PlanData } from "./types";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: true } },
});

// En el teléfono, "volver a la app" es AppState, no el foco de una ventana.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (status) => focusManager.setFocused(status === "active"));
}

export function usePlan(period: string) {
  return useQuery({
    queryKey: ["plan", period],
    queryFn: () => api<PlanData>("GET", `/api/plan/data?period=${period}`),
  });
}

export function useInbox() {
  return useQuery({
    queryKey: ["inbox"],
    queryFn: async () => (await api<{ items: InboxItemDTO[] }>("GET", "/api/plan/inbox")).items,
  });
}

/** Vuelve a pedir los datos cada vez que la pestaña se muestra. */
export function useRefetchOnFocus(refetch: () => unknown) {
  useFocusEffect(
    useCallback(() => {
      refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
}

export function useInvalidate() {
  const qc = useQueryClient();
  return useCallback(
    () => Promise.all([qc.invalidateQueries({ queryKey: ["plan"] }), qc.invalidateQueries({ queryKey: ["inbox"] })]),
    [qc],
  );
}

export { useMutation, useQueryClient };
