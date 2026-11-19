import { palette } from "../../design-system/tokens/palette";
import { bankColor } from "../../components/atoms";
import type { CardStatePill } from "../../components/organisms";
import { activeLocale, formatDate, parseLocal } from "../../i18n/format";
import type { StatementStatus } from "../../data";

/** Color de la tarjeta: el de su banco, o el violeta de Tarjetas si no se reconoce. */
export const cardColor = (entity: string | null | undefined): string => bankColor(entity) ?? palette.entity.cards;

export const statePill = (s: StatementStatus): CardStatePill => (s === "paid" ? "paid" : s === "overdue" ? "overdue" : s === "estimated" ? "estimated" : s === "empty" ? "empty" : "loaded");

/** «10 DIC» a partir de 'YYYY-MM-DD'. */
export function dayMonth(iso: string): { day: string; month: string } {
  const d = parseLocal(iso);
  let month = "";
  try { month = new Intl.DateTimeFormat(activeLocale(), { month: "short" }).format(d).replace(".", ""); } catch { month = String(d.getMonth() + 1); }
  return { day: String(d.getDate()), month: month.toUpperCase() };
}

/** «A PAGAR · VENCE 10 DIC», «PAGADO» o «A PAGAR». */
export function eyebrowFor(status: StatementStatus, dueDate: string | null): string {
  if (status === "paid") return "PAGADO";
  if (!dueDate) return "A PAGAR";
  const { day, month } = dayMonth(dueDate);
  return `A PAGAR · VENCE ${day} ${month}`;
}

/** «Hoy», «Ayer» o «12 nov». */
export function dayLabel(iso: string | null, today = new Date()): string {
  if (!iso) return "Sin fecha";
  const d = parseLocal(iso);
  const diff = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return formatDate(iso, "long");
}
