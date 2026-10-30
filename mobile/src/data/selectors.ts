import type { AppNotice, HomeSummary, PendingPayment } from "./types";

/** "Hoy podés gastar": lo libre dividido en los días que quedan, redondeado hacia abajo al peso, nunca negativo. */
export function dailyAllowance(free: number, daysLeft: number): number {
  if (!Number.isFinite(free) || !Number.isFinite(daysLeft) || daysLeft <= 0) return 0;
  return Math.max(0, Math.floor(free / daysLeft));
}

/** Avance de fijos pagados, 0..1. */
export function fixedProgressRatio(fixed: HomeSummary["fixed"]): number {
  if (fixed.total <= 0) return 0;
  return Math.min(1, Math.max(0, fixed.paid / fixed.total));
}

/** Suma de gastos por categoría. */
export function spendingTotal(items: HomeSummary["spendingByCategory"]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

/** Número del globo de la campana: pagos por confirmar + avisos sin leer. */
export function notificationBadgeCount(pending: PendingPayment[], notices: AppNotice[]): number {
  return pending.length + notices.filter((n) => !n.read).length;
}

/** El mes de la mascota: capítulo 1..3 según avance (útil para tests). */
export function clampChapter(chapter: number, chapters = 3): number {
  return Math.min(chapters, Math.max(1, Math.round(chapter)));
}
