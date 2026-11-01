import { useCallback } from "react";
import { AppState, Platform } from "react-native";
import { focusManager, QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MonthPlan, VoiceOutcome } from "../domain";
import { dataSource, DATA_SOURCE } from "./sources";
import { notificationBadgeCount } from "./selectors";
import { AppError, reportAppError, toAppError } from "./errors";
import { budgetView, categoryColorOrder, previousBudgetItems, withBudgetItems } from "./budget";
import { fixedExpensesView } from "./fixed";
import { movementsView, type MovementsFilter } from "./movements";
import type { BudgetItem, EntryKind, EntryPatch, NewEntryInput, NewLoanInput, VoiceInput } from "./types";

export { DATA_SOURCE, VOICE_SOURCE, REQUIRES_LOGIN } from "./sources";
export * from "./types";
export * from "./selectors";
export * from "./budget";
export * from "./plan";
export * from "./fixed";
export * from "./movements";
export { AppError, isMonthNotStarted, reportAppError, toAppError } from "./errors";
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
  plan: (period?: string) => ["plan", period ?? "current"] as const,
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

/** Todo lo del mes (`MonthPlan`). Inicio y el presupuesto salen de acá. */
export function usePlan(period?: string) {
  return useQuery({ queryKey: queryKeys.plan(period), queryFn: () => dataSource.getPlan(period) });
}

/** Presupuesto del mes listo para mostrar (`budgetView`). Comparte la query del plan: un solo pedido. */
export function useBudget(period?: string) {
  return useQuery({ queryKey: queryKeys.plan(period), queryFn: () => dataSource.getPlan(period), select: budgetView });
}

function useRefreshBudget() {
  const qc = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["plan"] }),
        qc.invalidateQueries({ queryKey: ["home"] }),
        qc.invalidateQueries({ queryKey: ["notifications"] }),
      ]),
    [qc],
  );
}

/** Mutación: guardar una o varias líneas del presupuesto (`{ period, items }`; monto 0 quita la línea). Refresca plan, Inicio y avisos. */
export function useSaveBudget() {
  const refresh = useRefreshBudget();
  return useMutation({
    mutationFn: ({ period, items }: { period: string; items: BudgetItem[] }) => dataSource.saveBudget(period, items),
    onSuccess: refresh,
  });
}

/** Orden de categorías para sus colores (`categoryColorOrder`): igual en Presupuesto y Gastos fijos. Comparte la query del plan. */
export function useCategoryColorOrder(period?: string): string[] {
  const { data } = useQuery({ queryKey: queryKeys.plan(period), queryFn: () => dataSource.getPlan(period), select: categoryColorOrder });
  return data ?? [];
}

/**
 * Mutación para editar el tope de UNA categoría en línea (`{ period, categoryId, amount }`; 0 lo quita). Es optimista:
 * aplica el cambio al plan en cache al instante (el Libre y la barra se recalculan solos) y, si falla, devuelve el
 * valor anterior. Refresca contra el servidor cuando termina la última edición en curso.
 */
export function useSaveBudgetLine() {
  const qc = useQueryClient();
  const refresh = useRefreshBudget();
  return useMutation({
    mutationKey: ["budget-line"],
    mutationFn: ({ period, categoryId, amount }: { period: string; categoryId: string; amount: number }) =>
      dataSource.saveBudget(period, [{ categoryId, amount }]),
    onMutate: async ({ period, categoryId, amount }) => {
      void qc.cancelQueries({ queryKey: ["plan"] });
      const previous = qc.getQueriesData<MonthPlan>({ queryKey: ["plan"] });
      for (const [key, plan] of previous) {
        if (plan && plan.period === period) qc.setQueryData<MonthPlan>(key, withBudgetItems(plan, [{ categoryId, amount }]));
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      for (const [key, plan] of context?.previous ?? []) qc.setQueryData(key, plan);
    },
    onSettled: () => (qc.isMutating({ mutationKey: ["budget-line"] }) <= 1 ? refresh() : undefined),
  });
}

/** Mutación: copiar el presupuesto del mes anterior al mes (`{ period }`). Falla si no hay nada para copiar. */
export function useCopyPreviousBudget() {
  const refresh = useRefreshBudget();
  return useMutation({
    mutationFn: async ({ period }: { period: string }) => {
      const items = previousBudgetItems(await dataSource.getPlan(period));
      if (items.length === 0) throw new Error("No hay presupuesto anterior para copiar.");
      await dataSource.saveBudget(period, items);
    },
    onSuccess: refresh,
  });
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
        qc.invalidateQueries({ queryKey: ["plan"] }),
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
        qc.invalidateQueries({ queryKey: ["plan"] }),
        qc.invalidateQueries({ queryKey: ["notifications"] }),
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
        qc.invalidateQueries({ queryKey: ["plan"] }),
        qc.invalidateQueries({ queryKey: ["notifications"] }),
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

function useRefreshEntries() {
  const qc = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["home"] }),
        qc.invalidateQueries({ queryKey: ["plan"] }),
        qc.invalidateQueries({ queryKey: ["notifications"] }),
        qc.invalidateQueries({ queryKey: ["wealth"] }),
      ]),
    [qc],
  );
}

/** Mutación: agregar un ingreso o un gasto (`NewEntryInput`). Refresca Inicio y Patrimonio. */
export function useAddEntry() {
  const refresh = useRefreshEntries();
  return useMutation({
    mutationFn: (input: NewEntryInput) => dataSource.addEntry(input),
    onSuccess: refresh,
  });
}

/** Gastos fijos del mes listos para mostrar (`fixedExpensesView`). Comparte la query del plan: un solo pedido. */
export function useFixedExpenses(period?: string) {
  return useQuery({ queryKey: queryKeys.plan(period), queryFn: () => dataSource.getPlan(period), select: fixedExpensesView });
}

/** Movimientos del mes filtrados (`movementsView`). Comparte la query del plan: un solo pedido. */
export function useMovements(period?: string, filter: MovementsFilter = {}) {
  const { kind, query } = filter;
  const select = useCallback((plan: MonthPlan) => movementsView(plan, { kind, query }), [kind, query]);
  return useQuery({ queryKey: queryKeys.plan(period), queryFn: () => dataSource.getPlan(period), select });
}

/** Mutación: editar un movimiento (`{ id, patch }`). Refresca plan, Inicio, avisos y patrimonio. */
export function useUpdateEntry() {
  const refresh = useRefreshEntries();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EntryPatch }) => dataSource.updateEntry(id, patch),
    onSuccess: refresh,
  });
}

/** Mutación: quitar un movimiento (`{ id, scope }`: `month` solo este mes, `rule` además deja de repetirse). */
export function useDeleteEntry() {
  const refresh = useRefreshEntries();
  return useMutation({
    mutationFn: ({ id, scope }: { id: string; scope: "month" | "rule" }) => dataSource.deleteEntry(id, scope),
    onSuccess: refresh,
  });
}

/** Mutación: marcar un movimiento como pagado o no (`{ id, isDone }`); atajo de `updateEntry`. */
export function useToggleEntryDone() {
  const refresh = useRefreshEntries();
  return useMutation({
    mutationFn: ({ id, isDone }: { id: string; isDone: boolean }) => dataSource.updateEntry(id, { isDone }),
    onSuccess: refresh,
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
