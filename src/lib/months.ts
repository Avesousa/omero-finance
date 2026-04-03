/** Pure month helpers — safe to import from both server and client components. */

export const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
] as const;

export type MonthName = (typeof MONTH_NAMES)[number];

export function isMonthInFuture(month: MonthName, year: number): boolean {
  const now          = new Date();
  const selectedMonth = MONTH_NAMES.indexOf(month);
  return year > now.getFullYear() ||
    (year === now.getFullYear() && selectedMonth > now.getMonth());
}

export function isCurrentMonth(month: MonthName, year: number): boolean {
  const now = new Date();
  return year === now.getFullYear() && MONTH_NAMES.indexOf(month) === now.getMonth();
}
