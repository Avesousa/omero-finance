/**
 * «Sin definir»: lo que el Balance dice que tenés y las cuentas todavía no explican.
 * Es `balance − suma de las cuentas en pesos`; no se guarda, se recalcula siempre. Menos de $ 1 de diferencia se ignora.
 */
export function unassignedBalance(balance: number, accountsArs: readonly number[]): number {
  const diff = Math.round((balance - accountsArs.reduce((n, x) => n + x, 0)) * 100) / 100;
  return Math.abs(diff) < 1 ? 0 : diff;
}
