import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { useActiveFinance } from "../../providers/ActiveFinanceProvider";
import { DATA_SOURCE } from "../../data/sources";
import type { AccountDTO, ResourceCardDTO, AccountMovementDTO, CardMovementDTO } from "../../../../src/lib/plan/account-types";
export type { AccountDTO, ResourceCardDTO, AccountMovementDTO, CardMovementDTO };
export function useAccounts(activeOnly = false, financeId?: string) {
 const { active } = useActiveFinance();
 return useQuery({ queryKey: ["accounts", active?.id, activeOnly, financeId], queryFn: async () => DATA_SOURCE === "mock" ? { accounts: [] as AccountDTO[] } : api<{ accounts: AccountDTO[] }>("GET", `/api/plan/accounts?activeOnly=${activeOnly ? 1 : 0}${financeId ? `&financeId=${encodeURIComponent(financeId)}` : ""}`) });
}
export function useResourceCards() {
 const { active } = useActiveFinance();
 return useQuery({ queryKey: ["resource-cards", active?.id], queryFn: async () => DATA_SOURCE === "mock" ? { cards: [] as ResourceCardDTO[] } : api<{ cards: ResourceCardDTO[] }>("GET", "/api/plan/cards") });
}
export function useAccountDetail(id: string) {
 const { active } = useActiveFinance();
 return useQuery({ queryKey: ["account-detail", id, active?.id], enabled: !!id, queryFn: () => api<{ account: AccountDTO; movements: AccountMovementDTO[] }>("GET", `/api/plan/accounts/${id}`) });
}
export function useCardDetail(id: string) {
 const { active } = useActiveFinance();
 return useQuery({ queryKey: ["card-detail", id, active?.id], enabled: !!id && DATA_SOURCE !== "mock", queryFn: () => api<{ movements: CardMovementDTO[] }>("GET", `/api/plan/cards/${id}`) });
}
export type RecentMovementDTO = AccountMovementDTO & { accountId: string; accountName: string };
export function useRecentMovements(limit = 6) {
 const { active } = useActiveFinance();
 return useQuery({ queryKey: ["account-movements", active?.id, limit], enabled: DATA_SOURCE !== "mock", queryFn: () => api<{ movements: RecentMovementDTO[] }>("GET", `/api/plan/account-movements?limit=${limit}`) });
}
export function useResourceMutation() {
 const qc = useQueryClient();
 return useMutation({ mutationFn: (input: { method: string; path: string; body?: unknown }) => api<{ id?: string; warning?: string | null }>(input.method, input.path, input.body), onSuccess: () => qc.invalidateQueries() });
}
