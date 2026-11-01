import {
  addMonths,
  balanceAt,
  type BalanceItemDTO,
  type MonthPlan,
} from "../../domain/index.ts";
import { cardsDebt, derivedWealthItems, wealthTotals } from "../selectors.ts";
import type {
  Card,
  CardBrand,
  CardPurchase,
  CardsOverview,
  DebtsOverview,
  WealthItem,
  WealthOverview,
} from "../types";

/**
 * Traducciones puras de lo que devuelve el backend a lo que muestra la app (sin red, con tests).
 * Tarjetas, deudas y patrimonio salen de la misma fuente que la web: `GET /api/plan/data` y `GET /api/plan/balance`.
 */

const BRANDS: CardBrand[] = ["VISA", "MC", "AMEX"];
const toBrand = (v: string | null): CardBrand | null => (v && (BRANDS as string[]).includes(v) ? (v as CardBrand) : null);

export function cardsFromPlan(plan: MonthPlan): CardsOverview {
  const categoryName = new Map(plan.categories.map((c) => [c.id, c.name]));
  const cards: Card[] = plan.cards.map((c) => ({
    id: c.id,
    name: c.name,
    entity: c.entity,
    brand: toBrand(c.cardType),
    owner: c.ownerName,
  }));
  const purchases: CardPurchase[] = plan.purchases.map((p) => ({
    id: p.id,
    cardId: p.cardId,
    description: p.description,
    categoryName: p.categoryId ? categoryName.get(p.categoryId) ?? null : null,
    currency: p.currency,
    total: p.amount,
    installments: p.installments,
    firstPeriod: p.firstPeriod,
  }));
  return {
    period: plan.period,
    today: plan.today,
    usdRate: plan.usdRate,
    cards,
    statements: plan.statements.map((s) => ({
      cardId: s.cardId,
      period: s.period,
      dueDate: s.dueDate,
      totalArs: s.totalArs,
      minimumArs: s.minimumArs,
      usdAmount: s.usdAmount,
      isPaid: s.isPaid,
    })),
    purchases,
  };
}

export function debtsFromPlan(plan: MonthPlan): DebtsOverview {
  return {
    period: plan.period,
    today: plan.today,
    usdRate: plan.usdRate,
    loans: plan.loans,
    cards: cardsDebt(cardsFromPlan(plan), plan.period),
  };
}

/** Activos y deudas cargados a mano, al saldo del período (y al del mes anterior para el delta). */
export function manualWealthItems(items: BalanceItemDTO[], period: string): WealthItem[] {
  const before = addMonths(period, -1);
  return items
    .filter((i) => !i.isArchived)
    .map((i) => ({
      id: i.id,
      kind: i.type === "DEBT" ? ("debt" as const) : ("asset" as const),
      source: "manual" as const,
      name: i.name,
      currency: i.currency,
      amount: balanceAt(i, period) ?? 0,
      previous: balanceAt(i, before),
    }));
}

/** Patrimonio del período, con los últimos 6 meses de historial (se recortan los meses vacíos del principio). */
export function wealthFromPlan(plan: MonthPlan, balance: BalanceItemDTO[]): WealthOverview {
  const overview = cardsFromPlan(plan);
  const itemsAt = (period: string) => [
    ...manualWealthItems(balance, period),
    ...derivedWealthItems(plan.loans, overview, period, plan.usdRate),
  ];
  const history: WealthOverview["history"] = [];
  for (let back = 5; back >= 0; back--) {
    const period = addMonths(plan.period, -back);
    const { net, assets, debts } = wealthTotals(itemsAt(period), plan.usdRate);
    if (history.length === 0 && assets === 0 && debts === 0 && back > 0) continue;
    history.push({ period, netArs: net });
  }
  return {
    period: plan.period,
    usdRate: plan.usdRate,
    items: itemsAt(plan.period),
    // Las metas todavía no existen en el backend: se ocultan hasta definirlas.
    goals: [],
    history,
  };
}
