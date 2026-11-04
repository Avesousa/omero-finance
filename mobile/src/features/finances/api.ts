import { api } from "../../../lib/api";
import type { FinanceDTO, FinanceMemberDTO, FinanceRole, MoveEntriesResult } from "../../../lib/types";

export const financeKeys = {
  members: (financeId: string) => ["finance-members", financeId] as const,
};

export async function fetchMembers(financeId: string): Promise<FinanceMemberDTO[]> {
  const res = await api<{ members: FinanceMemberDTO[] }>("GET", `/api/plan/finances/${financeId}/members`);
  return res.members;
}

export function addMember(financeId: string, email: string, role: FinanceRole) {
  return api<{ member: FinanceMemberDTO }>("POST", `/api/plan/finances/${financeId}/members`, { email, role });
}

export function setMemberRole(financeId: string, userId: string, role: FinanceRole) {
  return api<{ member: FinanceMemberDTO }>("PATCH", `/api/plan/finances/${financeId}/members/${userId}`, { role });
}

export function removeMember(financeId: string, userId: string) {
  return api<{ ok: true }>("DELETE", `/api/plan/finances/${financeId}/members/${userId}`);
}

export function updateFinance(financeId: string, patch: { name?: string; color?: string }) {
  return api<{ finance: FinanceDTO }>("PATCH", `/api/plan/finances/${financeId}`, patch);
}

export function moveEntries(entryIds: string[], toFinanceId: string) {
  return api<MoveEntriesResult>("POST", "/api/plan/entries/move", { entryIds, toFinanceId });
}
