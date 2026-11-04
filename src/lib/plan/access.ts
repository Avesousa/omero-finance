/**
 * Regla única de acceso a finanzas (contrato, principio 2).
 *
 * Se puede acceder a una finanza si el usuario es su `ownerUserId` (ADMIN implícito) o tiene una
 * fila en `FinanceMember` con un rol que permita la acción. Nada más.
 * Única excepción, solo para la finanza ACTIVA POR DEFECTO sin header (ver resolveFinance):
 * un hogar legacy que todavía no pasó por el backfill (sin dueño).
 */

import { prisma } from "@/lib/prisma";
import { ApiError } from "./api-error";

export type Action = "read" | "create" | "update" | "delete" | "manage";
export type Role = "ADMIN" | "EDITOR" | "VIEWER";
export const ROLES = ["ADMIN", "EDITOR", "VIEWER"] as const;
export type FinanceKindName = "PERSONAL" | "SHARED";

const ROLE_ACTIONS: Record<Role, readonly Action[]> = {
  ADMIN: ["read", "create", "update", "delete", "manage"],
  EDITOR: ["read", "create", "update", "delete"],
  VIEWER: ["read"],
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrador",
  EDITOR: "Editor",
  VIEWER: "Lector",
};

/** Pura. Tabla de la sección 3.2 de la spec. */
export function roleAllows(role: Role | null, action: Action): boolean {
  return role !== null && ROLE_ACTIONS[role].includes(action);
}

export interface FinanceRef {
  id: string;
  ownerUserId: string | null;
}

export interface ActiveFinance extends FinanceRef {
  kind: FinanceKindName;
  name: string;
  color: string | null;
}

export const NO_FINANCE_ACCESS = "No tenés acceso a esa finanza";

/** Rol efectivo: ADMIN si es dueño, si no el de FinanceMember, si no null. */
export async function roleIn(userId: string, finance: FinanceRef): Promise<Role | null> {
  if (finance.ownerUserId === userId) return "ADMIN";
  const member = await prisma.financeMember.findUnique({
    where: { userId_householdId: { userId, householdId: finance.id } },
    select: { role: true },
  });
  return member?.role ?? null;
}

/** LA regla de acceso. `resource` es cualquier fila que tenga `householdId`. */
export async function canAccess(
  user: { id: string },
  resource: { householdId: string },
  action: Action,
): Promise<boolean> {
  const finance = await prisma.household.findUnique({
    where: { id: resource.householdId },
    select: { id: true, ownerUserId: true },
  });
  if (!finance) return false;
  return roleAllows(await roleIn(user.id, finance), action);
}

/**
 * Para ids sueltos: la fila se cargó sin filtro de finanza y se autoriza contra SU finanza.
 * No existe o no es miembro → 404 (no se filtra la existencia). Miembro sin permiso → 403.
 */
export async function assertAccess(
  user: { id: string },
  row: { householdId: string } | null,
  action: Action,
): Promise<void> {
  if (!row) throw new ApiError("No encontrado", 404);
  const finance = await prisma.household.findUnique({
    where: { id: row.householdId },
    select: { id: true, ownerUserId: true, name: true },
  });
  if (!finance) throw new ApiError("No encontrado", 404);
  const role = await roleIn(user.id, finance);
  if (!role) throw new ApiError("No encontrado", 404);
  if (!roleAllows(role, action)) throw denied(role, finance.name);
}

export function denied(role: Role, financeName: string): ApiError {
  return new ApiError(
    role === "VIEWER"
      ? `Tu rol en ${financeName} es ${ROLE_LABEL[role]}: solo podés ver.`
      : `Tu rol en ${financeName} es ${ROLE_LABEL[role]}: no podés hacer esto`,
    403,
  );
}

/**
 * Resuelve la finanza activa. `requestedId` viene del header `x-finance-id` o la cookie
 * `omero_finance`; el servidor nunca confía en él: se valida con el rol del usuario.
 * Sin id usa `fallbackHouseholdId` (User.householdId) — compatibilidad con clientes viejos.
 */
export async function resolveFinance(
  userId: string,
  requestedId: string | null,
  fallbackHouseholdId: string,
): Promise<{ householdId: string; role: Role; finance: ActiveFinance }> {
  const targetId = requestedId || fallbackHouseholdId;
  const row = await prisma.household.findUnique({
    where: { id: targetId },
    select: { id: true, ownerUserId: true, kind: true, name: true, color: true },
  });
  // Mismo mensaje para "no existe" y "no es tuya": no revela existencia.
  if (!row) {
    if (requestedId) throw new ApiError(NO_FINANCE_ACCESS, 403);
    return personalFallback(userId);
  }

  let role = await roleIn(userId, row);

  if (!role && !requestedId) {
    // Sin header y sin rol en la finanza por defecto:
    //  · hogar legacy sin dueño (aún sin backfill) al que el usuario pertenece → ADMIN legacy,
    //    es lo que podía hacer hasta hoy; el backfill lo normaliza.
    //  · cualquier otro caso → su Personal (se crea si no existe).
    if (row.ownerUserId === null) role = "ADMIN";
    else return personalFallback(userId);
  }
  if (!role) throw new ApiError(NO_FINANCE_ACCESS, 403);
  return { householdId: row.id, role, finance: toActive(row) };
}

async function personalFallback(userId: string) {
  const id = await ensurePersonalFinanceId(userId);
  const row = await prisma.household.findUniqueOrThrow({
    where: { id },
    select: { id: true, ownerUserId: true, kind: true, name: true, color: true },
  });
  return { householdId: row.id, role: "ADMIN" as Role, finance: toActive(row) };
}

function toActive(row: { id: string; ownerUserId: string | null; kind: FinanceKindName; name: string; color: string | null }): ActiveFinance {
  return { id: row.id, ownerUserId: row.ownerUserId, kind: row.kind, name: row.name, color: row.color };
}

/**
 * Devuelve la finanza PERSONAL del usuario, creándola si falta (idempotente).
 * Vive acá (y finances.ts la reexporta) para que resolveFinance no dependa de finances.ts.
 */
export async function ensurePersonalFinanceId(userId: string): Promise<string> {
  const existing = await prisma.household.findFirst({
    where: { ownerUserId: userId, kind: "PERSONAL" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing.id;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true } });
  return prisma.$transaction(async (tx) => {
    // Re-chequeo dentro de la transacción: dos requests simultáneos no duplican la Personal.
    const again = await tx.household.findFirst({ where: { ownerUserId: userId, kind: "PERSONAL" }, select: { id: true } });
    if (again) return again.id;
    const created = await tx.household.create({
      data: {
        name: `Personal de ${user.name}`,
        type: "PERSONAL",
        kind: "PERSONAL",
        ownerUserId: userId,
        members: { create: { userId, role: "ADMIN" } },
      },
    });
    return created.id;
  });
}
