import { unassignedBalance, useHome } from "../../data";
import { useActiveFinance } from "../../providers/ActiveFinanceProvider";
import type { AccountDTO } from "./data";

/** «Sin definir» de la finanza activa: balance de Inicio menos la suma de sus cuentas en pesos. `amount` es 0 si cierran (o no hay datos). */
export function useUnassigned(accounts: readonly AccountDTO[]) {
  const home = useHome();
  const { active } = useActiveFinance();
  const own = accounts.filter((a) => !a.isArchived && a.currency === "ARS" && a.householdId === active?.id);
  const accountsTotal = own.reduce((n, a) => n + a.balance, 0);
  const balance = home.data?.balance ?? null;
  return { amount: balance == null ? 0 : unassignedBalance(balance, own.map((a) => a.balance)), balance, accountsTotal };
}
