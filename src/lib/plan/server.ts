/**
 * Plan simple — acceso a datos y helpers para las rutas /api/plan/*.
 * Solo servidor.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";
import {
  TDC_KEY, addMonths, buildProposal, currentPeriod, isValidPeriod, todayIso,
  type BalanceItemDTO, type BudgetDTO, type CardDTO, type CategoryDTO, type Currency,
  type EntryDTO, type Frequency, type Kind, type PayMode, type ProposalRow,
  type PurchaseDTO, type RecurringDTO, type StatementDTO,
} from "./core";

// ─── Categorías por defecto ───────────────────────────────────────────────────

const DEFAULT_EXPENSE = [
  "Alquiler", "Expensas", "Servicios", "Supermercado", "Transporte", "Salud",
  "Educación", "Suscripciones", "Familia", "Salidas y ocio", "Compras",
  "Deudas y préstamos", "Ahorro e inversión", "Otros",
];
const DEFAULT_INCOME = ["Sueldo", "Freelance", "Extras", "Inversiones", "Cobro de deudas", "Otros"];
const CARDS_CATEGORY = "Tarjetas de crédito";

/** Crea las categorías por defecto la primera vez que un hogar entra a /plan. */
export async function ensurePlanDefaults(householdId: string): Promise<void> {
  const count = await prisma.planCategory.count({ where: { householdId } });
  if (count > 0) return;
  await prisma.planCategory.createMany({
    data: [
      ...DEFAULT_EXPENSE.map((name, i) => ({ householdId, kind: "EXPENSE" as const, name, sortOrder: i })),
      { householdId, kind: "EXPENSE" as const, name: CARDS_CATEGORY, systemKey: TDC_KEY, sortOrder: 100 },
      ...DEFAULT_INCOME.map((name, i) => ({ householdId, kind: "INCOME" as const, name, sortOrder: i })),
    ],
    skipDuplicates: true,
  });
}

// ─── Carga del mes ────────────────────────────────────────────────────────────

export interface PlanData {
  period: string;
  /** Hoy en Buenos Aires ("YYYY-MM-DD"). */
  today: string;
  started: boolean;
  usdRate: number;
  categories: CategoryDTO[];
  recurrings: RecurringDTO[];
  entries: EntryDTO[];
  budgets: BudgetDTO[];
  /** Presupuesto del último mes anterior que tenga uno (para copiar). */
  previousBudgets: BudgetDTO[];
  previousBudgetPeriod: string | null;
  cards: CardDTO[];
  /** Resúmenes cargados por tarjeta en todos los meses (para avisar antes de borrarla). */
  cardStatementCounts: Record<string, number>;
  statements: StatementDTO[];
  purchases: PurchaseDTO[];
  /** Fijos que se traerían al iniciar el mes (solo si no está iniciado). */
  proposal: ProposalRow[];
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const num = (d: unknown) => (d == null ? null : Number(d));

export function resolvePeriod(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isValidPeriod(value) ? value : currentPeriod();
}

async function latestUsdRate(householdId: string, period: string): Promise<number> {
  const prevMonth = await prisma.planMonth.findFirst({
    where: { householdId, period: { lt: period } },
    orderBy: { period: "desc" },
  });
  const rate = await prisma.exchangeRate.findFirst({
    where: { OR: [{ householdId }, { householdId: null }] },
    orderBy: { date: "desc" },
  });
  if (rate) return Number(rate.usdArs);
  if (prevMonth) return Number(prevMonth.usdRate);
  return 0;
}

export async function loadPlan(householdId: string, period: string): Promise<PlanData> {
  await ensurePlanDefaults(householdId);

  const [month, categories, recurrings, entries, budgets, cards, statements, purchases, statementCounts] =
    await Promise.all([
      prisma.planMonth.findUnique({ where: { householdId_period: { householdId, period } } }),
      prisma.planCategory.findMany({
        where: { householdId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.planRecurring.findMany({
        where: { householdId, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      prisma.planEntry.findMany({
        where: { householdId, period },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      prisma.planBudget.findMany({ where: { householdId, period } }),
      prisma.card.findMany({ where: { householdId }, orderBy: [{ entity: "asc" }, { name: "asc" }] }),
      prisma.planCardStatement.findMany({ where: { householdId, period } }),
      prisma.planCardPurchase.findMany({
        where: { householdId },
        orderBy: [{ firstPeriod: "desc" }, { createdAt: "desc" }],
      }),
      prisma.planCardStatement.groupBy({
        by: ["cardId"],
        where: { householdId },
        _count: { _all: true },
      }),
    ]);

  let previousBudgets: BudgetDTO[] = [];
  let previousBudgetPeriod: string | null = null;
  if (budgets.length === 0) {
    const last = await prisma.planBudget.findFirst({
      where: { householdId, period: { lt: period } },
      orderBy: { period: "desc" },
    });
    if (last) {
      previousBudgetPeriod = last.period;
      const rows = await prisma.planBudget.findMany({ where: { householdId, period: last.period } });
      previousBudgets = rows.map((b) => ({ categoryId: b.categoryId, amount: Number(b.amount) }));
    }
  }

  const recurringDtos: RecurringDTO[] = recurrings.map((r) => ({
    id: r.id,
    kind: r.kind as Kind,
    name: r.name,
    categoryId: r.categoryId,
    targetCategoryId: r.targetCategoryId,
    currency: r.currency as Currency,
    amount: Number(r.amount),
    frequency: r.frequency as Frequency,
    weekday: r.weekday,
    dueDay: r.dueDay,
    isActive: r.isActive,
  }));

  return {
    period,
    today: todayIso(),
    started: !!month,
    usdRate: month ? Number(month.usdRate) : await latestUsdRate(householdId, period),
    categories: categories.map((c) => ({
      id: c.id,
      kind: c.kind as Kind,
      name: c.name,
      systemKey: c.systemKey,
      isArchived: c.isArchived,
      sortOrder: c.sortOrder,
    })),
    recurrings: recurringDtos,
    entries: entries.map((e) => ({
      id: e.id,
      period: e.period,
      kind: e.kind as Kind,
      recurringId: e.recurringId,
      name: e.name,
      categoryId: e.categoryId,
      targetCategoryId: e.targetCategoryId,
      currency: e.currency as Currency,
      amount: Number(e.amount),
      date: iso(e.date),
      isDone: e.isDone,
      note: e.note,
    })),
    budgets: budgets.map((b) => ({ categoryId: b.categoryId, amount: Number(b.amount) })),
    previousBudgets,
    previousBudgetPeriod,
    cards: cards.map((c) => ({
      id: c.id,
      name: c.name,
      entity: c.entity,
      cardType: c.cardType,
      ownerName: c.ownerName,
    })),
    cardStatementCounts: Object.fromEntries(statementCounts.map((g) => [g.cardId, g._count._all])),
    statements: statements.map((s) => ({
      id: s.id,
      cardId: s.cardId,
      period: s.period,
      dueDate: iso(s.dueDate),
      totalArs: Number(s.totalArs),
      minimumArs: num(s.minimumArs),
      usdAmount: num(s.usdAmount),
      payMode: s.payMode as PayMode,
      customAmount: num(s.customAmount),
      isPaid: s.isPaid,
    })),
    purchases: purchases.map((p) => ({
      id: p.id,
      cardId: p.cardId,
      description: p.description,
      categoryId: p.categoryId,
      currency: p.currency as Currency,
      amount: Number(p.amount),
      installments: p.installments,
      firstPeriod: p.firstPeriod,
      purchaseDate: iso(p.purchaseDate),
      note: p.note,
    })),
    proposal: month ? [] : buildProposal(recurringDtos, period),
  };
}

export async function loadBalance(householdId: string): Promise<BalanceItemDTO[]> {
  const items = await prisma.planBalanceItem.findMany({
    where: { householdId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { values: true },
  });
  return items.map((i) => ({
    id: i.id,
    type: i.type,
    name: i.name,
    currency: i.currency as Currency,
    isArchived: i.isArchived,
    values: Object.fromEntries(i.values.map((v) => [v.period, Number(v.amount)])),
  }));
}

/** Tipo de cambio a usar para un mes (el del mes si está iniciado). */
export async function usdRateFor(householdId: string, period: string): Promise<number> {
  const month = await prisma.planMonth.findUnique({
    where: { householdId_period: { householdId, period } },
  });
  return month ? Number(month.usdRate) : latestUsdRate(householdId, period);
}

// ─── Helpers de API ───────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface ApiContext {
  householdId: string;
  userId: string;
}

/** Resuelve la sesión y unifica el manejo de errores de las rutas. */
export async function withSession(
  req: NextRequest,
  handler: (ctx: ApiContext) => Promise<Response>,
): Promise<Response> {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return unauthorized();
  }
  try {
    return await handler({ householdId: session.user.householdId, userId: session.user.id });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(`[${new URL(req.url).pathname} ${req.method}]`, err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {
    /* cae al error de abajo */
  }
  throw new ApiError("Cuerpo inválido");
}

export const v = {
  period(value: unknown): string {
    if (!isValidPeriod(value)) throw new ApiError("Mes inválido");
    return value;
  },
  /** Mes dentro de un rango razonable (evita typos como 2206-10). */
  nearPeriod(value: unknown): string {
    const p = v.period(value);
    const now = currentPeriod();
    if (p < addMonths(now, -120) || p > addMonths(now, 120)) throw new ApiError("Mes fuera de rango");
    return p;
  },
  text(value: unknown, label: string, max = 120): string {
    if (typeof value !== "string" || !value.trim()) throw new ApiError(`${label} es obligatorio`);
    return value.trim().slice(0, max);
  },
  optionalText(value: unknown, max = 500): string | null {
    if (typeof value !== "string" || !value.trim()) return null;
    return value.trim().slice(0, max);
  },
  amount(value: unknown, label = "Monto", { allowZero = false } = {}): number {
    const n = typeof value === "string" ? Number(value) : value;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || (!allowZero && n === 0)) {
      throw new ApiError(`${label} inválido`);
    }
    if (n > 999_999_999_999) throw new ApiError(`${label} demasiado grande`);
    return Math.round(n * 100) / 100;
  },
  optionalAmount(value: unknown, label = "Monto"): number | null {
    if (value == null || value === "") return null;
    return v.amount(value, label, { allowZero: true });
  },
  int(value: unknown, label: string, min: number, max: number): number {
    const n = typeof value === "string" ? Number(value) : value;
    if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max) {
      throw new ApiError(`${label} inválido`);
    }
    return n;
  },
  optionalInt(value: unknown, label: string, min: number, max: number): number | null {
    if (value == null || value === "") return null;
    return v.int(value, label, min, max);
  },
  oneOf<T extends string>(value: unknown, options: readonly T[], label: string): T {
    if (typeof value !== "string" || !options.includes(value as T)) {
      throw new ApiError(`${label} inválido`);
    }
    return value as T;
  },
  currency(value: unknown): Currency {
    return value === "USD" ? "USD" : "ARS";
  },
  /** "YYYY-MM-DD" → Date (UTC) o null. */
  optionalDate(value: unknown): Date | null {
    if (value == null || value === "") return null;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new ApiError("Fecha inválida");
    }
    const d = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) throw new ApiError("Fecha inválida");
    return d;
  },
};

export const KINDS = ["INCOME", "EXPENSE"] as const;
export const FREQUENCIES = ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"] as const;
export const PAY_MODES = ["TOTAL", "MINIMUM", "CUSTOM"] as const;

/** Valida que la categoría sea del hogar y del tipo esperado. Devuelve su id o null. */
export async function categoryIdOrNull(
  householdId: string,
  value: unknown,
  kind: Kind,
): Promise<string | null> {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new ApiError("Categoría inválida");
  const cat = await prisma.planCategory.findFirst({ where: { id: value, householdId, kind } });
  if (!cat) throw new ApiError("Categoría inválida");
  return cat.id;
}

export async function requireCard(householdId: string, value: unknown): Promise<string> {
  if (typeof value !== "string" || !value) throw new ApiError("Elegí una tarjeta");
  const card = await prisma.card.findFirst({ where: { id: value, householdId } });
  if (!card) throw new ApiError("Tarjeta inválida");
  return card.id;
}

export async function requireStartedMonth(householdId: string, period: string): Promise<void> {
  const month = await prisma.planMonth.findUnique({
    where: { householdId_period: { householdId, period } },
  });
  if (!month) throw new ApiError("Primero iniciá el mes", 409);
}
