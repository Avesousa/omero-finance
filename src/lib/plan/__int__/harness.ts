/**
 * Arnés de integración (R8): usuarios y sesiones reales en la base LOCAL, handlers invocados con NextRequest.
 * Se niega a correr contra cualquier base que no sea localhost (nunca Neon/producción).
 */

import { randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export function assertLocalDb(): void {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(url)) {
    throw new Error("Las pruebas de integración solo corren contra una base local (DATABASE_URL no es localhost).");
  }
}

export const RUN = randomBytes(4).toString("hex");

export interface TestUser {
  id: string;
  name: string;
  email: string;
  token: string;
  personalId: string;
}

const createdUserIds: string[] = [];

/** Usuario con su finanza Personal (como la deja el backfill) y una sesión Bearer. */
export async function makeUser(label: string): Promise<TestUser> {
  const name = `${label}-${RUN}`;
  const email = `it-${label.toLowerCase()}-${RUN}@int.test`;
  const home = await prisma.household.create({ data: { name: `Personal de ${name}`, type: "PERSONAL", kind: "PERSONAL" } });
  const user = await prisma.user.create({
    data: { name, email, passwordHash: "x", householdId: home.id, role: "ADMIN" },
  });
  await prisma.household.update({ where: { id: home.id }, data: { ownerUserId: user.id } });
  await prisma.financeMember.create({ data: { userId: user.id, householdId: home.id, role: "ADMIN" } });
  const token = `it_${randomBytes(16).toString("hex")}`;
  await prisma.session.create({ data: { userId: user.id, token, expiresAt: new Date(Date.now() + 3600_000) } });
  createdUserIds.push(user.id);
  return { id: user.id, name, email, token, personalId: home.id };
}

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export interface CallOptions {
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  /** Finanza activa (header x-finance-id). */
  finance?: string;
  /** Bearer crudo (para tokens de Apple Pay). */
  bearer?: string;
}

export async function call(
  handler: Handler,
  user: TestUser | null,
  opts: CallOptions = {},
): Promise<{ status: number; json: any }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (user) headers.authorization = `Bearer ${user.token}`;
  if (opts.bearer) headers.authorization = `Bearer ${opts.bearer}`;
  if (opts.finance) headers["x-finance-id"] = opts.finance;
  const hasBody = opts.body !== undefined;
  if (hasBody) headers["content-type"] = "application/json";
  const req = new NextRequest(opts.url ?? "http://localhost/api/plan/x", {
    method: opts.method ?? "GET",
    headers,
    body: hasBody ? JSON.stringify(opts.body) : undefined,
  });
  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
  let json: unknown = null;
  try { json = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, json };
}

/**
 * Borra todo lo que crearon los tests: usuarios `@int.test` (también restos de corridas anteriores),
 * las finanzas que les pertenecen o a las que apuntan, y lo que cuelga de ellas.
 */
export async function cleanup(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { OR: [{ id: { in: createdUserIds } }, { email: { endsWith: "@int.test" } }] },
    select: { id: true, householdId: true },
  });
  if (users.length === 0) return;
  const userIds = users.map((u) => u.id);
  const owned = await prisma.household.findMany({ where: { ownerUserId: { in: userIds } }, select: { id: true } });
  const hh = [...new Set([...owned.map((h) => h.id), ...users.map((u) => u.householdId)])];

  // Todas las tablas con householdId (menos User/Household/FinanceMember), reintentando por orden de FK.
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT DISTINCT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'householdId'
      AND table_name NOT IN ('User', 'Household', 'FinanceMember')`;
  let pending = tables.map((t) => t.table_name);
  for (let pass = 0; pass < 6 && pending.length > 0; pass++) {
    const failed: string[] = [];
    for (const table of pending) {
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM "${table}" WHERE "householdId" = ANY($1::text[])`, hh);
      } catch {
        failed.push(table);
      }
    }
    pending = failed;
  }
  await prisma.financeMember.deleteMany({ where: { OR: [{ householdId: { in: hh } }, { userId: { in: userIds } }] } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.household.updateMany({ where: { id: { in: hh } }, data: { ownerUserId: null } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.household.deleteMany({ where: { id: { in: hh } } });
}
