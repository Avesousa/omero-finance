/**
 * Finanzas: paleta de colores, listado por usuario y "Mover a finanza".
 * Solo servidor. La regla de acceso vive en access.ts.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensurePersonalFinanceId, type FinanceKindName, type Role } from "./access";

// ─── Paleta ───────────────────────────────────────────────────────────────────
// Se copia a mobile/src/design-system/tokens/financeColors.ts (hay un test de paridad).

export const FINANCE_PALETTE = {
  violeta:  { light: "#6A43B8", dark: "#B79CF0" },
  azul:     { light: "#1F5FBF", dark: "#7FB0F5" },
  naranja:  { light: "#B45309", dark: "#F0B84A" },
  rosa:     { light: "#B83280", dark: "#F29BCB" },
  turquesa: { light: "#0E7C86", dark: "#6FD3DB" },
  rojo:     { light: "#A3352B", dark: "#F08A7E" },
} as const;

export type PaletteKey = keyof typeof FINANCE_PALETTE;
export const DEFAULT_SHARED_COLOR: PaletteKey = "violeta";
export const OMERO_PERSONAL = { light: "#0F6B4F", dark: "#5FD3A4" } as const;

export function isPaletteKey(v: unknown): v is PaletteKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(FINANCE_PALETTE, v);
}

// ─── Listado ──────────────────────────────────────────────────────────────────

export interface FinanceDTO {
  id: string;
  name: string;
  kind: FinanceKindName;
  color: string | null;
  role: Role;
  ownerUserId: string | null;
  isOwner: boolean;
  memberCount: number;
}

type FinanceRow = {
  id: string; name: string; kind: FinanceKindName; color: string | null; ownerUserId: string | null;
  _count: { members: number };
};

export function toFinanceDTO(row: FinanceRow, userId: string, role: Role): FinanceDTO {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    color: row.color,
    role,
    ownerUserId: row.ownerUserId,
    isOwner: row.ownerUserId === userId,
    memberCount: Math.max(row._count.members, 1),
  };
}

/** Finanzas donde el usuario es dueño o miembro, la Personal primero y después por antigüedad. */
export async function listFinancesFor(userId: string): Promise<FinanceDTO[]> {
  const rows = await prisma.household.findMany({
    where: { OR: [{ ownerUserId: userId }, { members: { some: { userId } } }] },
    select: {
      id: true, name: true, kind: true, color: true, ownerUserId: true, createdAt: true,
      _count: { select: { members: true } },
      members: { where: { userId }, select: { role: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const dtos = rows.map((r) => {
    const role: Role = r.ownerUserId === userId ? "ADMIN" : (r.members[0]?.role ?? "VIEWER");
    return toFinanceDTO(r, userId, role);
  });
  // PERSONAL propia primero, el resto en orden de creación.
  return dtos.sort((a, b) => Number(b.kind === "PERSONAL" && b.isOwner) - Number(a.kind === "PERSONAL" && a.isOwner));
}

/** Finanza PERSONAL del usuario; la crea si falta (idempotente). */
export const ensurePersonalFinance = ensurePersonalFinanceId;

/** Cantidad de administradores efectivos: el dueño (siempre) más los miembros ADMIN que no son el dueño. */
export async function countAdmins(finance: { id: string; ownerUserId: string | null }): Promise<number> {
  const others = await prisma.financeMember.count({
    where: {
      householdId: finance.id,
      role: "ADMIN",
      ...(finance.ownerUserId ? { userId: { not: finance.ownerUserId } } : {}),
    },
  });
  return others + (finance.ownerUserId ? 1 : 0);
}

// ─── Mover a finanza ──────────────────────────────────────────────────────────

type Tx = Prisma.TransactionClient;

/**
 * Mapea ids de categoría de `fromId` a las de `toId` por nombre (sin distinguir mayúsculas)
 * y mismo `kind`. Sin equivalente → null ("Sin categoría").
 */
export async function mapCategoriesByName(
  tx: Tx,
  fromId: string,
  toId: string,
  ids: string[],
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  if (ids.length === 0) return result;

  const [source, target] = await Promise.all([
    tx.planCategory.findMany({ where: { householdId: fromId, id: { in: ids } }, select: { id: true, kind: true, name: true } }),
    tx.planCategory.findMany({ where: { householdId: toId }, select: { id: true, kind: true, name: true, isArchived: true } }),
  ]);

  const key = (kind: string, name: string) => `${kind}:${name.trim().toLowerCase()}`;
  const byName = new Map<string, string>();
  // Las archivadas solo valen si no hay una activa con el mismo nombre.
  for (const c of [...target].sort((a, b) => Number(b.isArchived) - Number(a.isArchived))) {
    byName.set(key(c.kind, c.name), c.id);
  }
  for (const c of source) result.set(c.id, byName.get(key(c.kind, c.name)) ?? null);
  for (const id of ids) if (!result.has(id)) result.set(id, null);
  return result;
}

export interface MoveResult {
  moved: string[];
  skipped: { id: string; reason: string }[];
}

/**
 * Mueve movimientos de `fromId` a `toId` dentro de la transacción recibida.
 * Quien llama debe haber autorizado (update en origen, create en destino) y llamado antes a
 * `ensurePlanDefaults(toId)` para que existan las categorías de destino.
 *
 * Conserva period/amount/currency/name/date/note/isDone. Si el mes de destino no está iniciado,
 * lo inicia con el MISMO tipo de cambio del mes de origen; si ya está, respeta el del destino.
 * No mueve fijos (recurringId) ni cuotas de préstamo (loanId); los reporta en `skipped`.
 */
export async function moveEntries(
  tx: Tx,
  input: { entryIds: string[]; fromId: string; toId: string },
): Promise<MoveResult> {
  const { fromId, toId } = input;
  const entryIds = [...new Set(input.entryIds)];
  const entries = await tx.planEntry.findMany({ where: { id: { in: entryIds }, householdId: fromId } });
  const byId = new Map(entries.map((e) => [e.id, e]));

  const skipped: MoveResult["skipped"] = [];
  const movable = [];
  for (const id of entryIds) {
    const e = byId.get(id);
    if (!e) skipped.push({ id, reason: "No encontrado" });
    else if (e.recurringId) skipped.push({ id, reason: "Es un fijo; editá el fijo." });
    else if (e.loanId) skipped.push({ id, reason: "Es una cuota de un préstamo." });
    else movable.push(e);
  }
  if (movable.length === 0) return { moved: [], skipped };

  // Mes de destino: se inicia con el tipo de cambio del origen si todavía no existe.
  const periods = [...new Set(movable.map((e) => e.period))];
  const [fromMonths, toMonths] = await Promise.all([
    tx.planMonth.findMany({ where: { householdId: fromId, period: { in: periods } } }),
    tx.planMonth.findMany({ where: { householdId: toId, period: { in: periods } } }),
  ]);
  const haveTo = new Set(toMonths.map((m) => m.period));
  for (const m of fromMonths) {
    if (!haveTo.has(m.period)) {
      await tx.planMonth.create({ data: { householdId: toId, period: m.period, usdRate: m.usdRate } });
    }
  }

  const catIds = [...new Set(movable.flatMap((e) => [e.categoryId, e.targetCategoryId]).filter((x): x is string => !!x))];
  const catMap = await mapCategoriesByName(tx, fromId, toId, catIds);
  const remap = (id: string | null) => (id ? (catMap.get(id) ?? null) : null);

  const moved: string[] = [];
  for (const e of movable) {
    // Filtra por origen: si otro request ya lo movió, no encuentra la fila y se reporta.
    const res = await tx.planEntry.updateMany({
      where: { id: e.id, householdId: fromId },
      data: { householdId: toId, categoryId: remap(e.categoryId), targetCategoryId: remap(e.targetCategoryId) },
    });
    if (res.count === 1) moved.push(e.id);
    else skipped.push({ id: e.id, reason: "No encontrado" });
  }
  return { moved, skipped };
}

/** Wrapper transaccional para las rutas. */
export function moveEntriesTx(input: { entryIds: string[]; fromId: string; toId: string }): Promise<MoveResult> {
  return prisma.$transaction((tx) => moveEntries(tx, input));
}
