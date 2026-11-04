/**
 * Backfill S1 — dueño y finanzas. Idempotente.
 *
 *   npx tsx prisma/backfill/finanzas-s1.ts --dry-run   # solo imprime
 *   npx tsx prisma/backfill/finanzas-s1.ts             # aplica
 *
 * Usa DATABASE_URL de .env.local (si existe) o .env. Revisá a qué base apunta antes de aplicar:
 * el script imprime el host al arrancar.
 *
 * 1. Hogar con ownerUserId NULL y al menos un usuario → dueño = ADMIN más antiguo (si no hay,
 *    el más antiguo por createdAt); kind = PERSONAL.
 * 2. FinanceMember: solo el dueño, ADMIN (nunca baja un rol existente).
 * 3. Cada User sin su propia finanza PERSONAL → se la crea (+ FinanceMember ADMIN +
 *    categorías por defecto) y se reapunta User.householdId a ella.
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();

import type { PrismaClient } from "@prisma/client";

export interface BackfillSummary {
  householdsOwned: number;
  membersCreated: number;
  personalsCreated: number;
  usersRepointed: number;
}

type Log = (msg: string) => void;

export async function runBackfill(
  prisma: PrismaClient,
  opts: { dryRun?: boolean; log?: Log; ensureDefaults?: (householdId: string) => Promise<void> } = {},
): Promise<BackfillSummary> {
  const { dryRun = false, log = () => {}, ensureDefaults } = opts;
  const summary: BackfillSummary = { householdsOwned: 0, membersCreated: 0, personalsCreated: 0, usersRepointed: 0 };

  // ── 1 y 2: dueño + miembro ADMIN de los hogares existentes ──────────────────
  const households = await prisma.household.findMany({
    include: { users: { orderBy: { createdAt: "asc" } }, members: true },
    orderBy: { createdAt: "asc" },
  });

  for (const h of households) {
    let ownerId = h.ownerUserId;
    if (!ownerId && h.users.length > 0) {
      const owner = h.users.find((u) => u.role === "ADMIN") ?? h.users[0];
      ownerId = owner.id;
      log(`hogar ${h.id} (${h.name}): dueño → ${owner.name}`);
      summary.householdsOwned++;
      if (!dryRun) {
        await prisma.household.update({ where: { id: h.id }, data: { ownerUserId: ownerId, kind: "PERSONAL" } });
      }
    }
    if (ownerId && !h.members.some((m) => m.userId === ownerId)) {
      log(`hogar ${h.id}: FinanceMember ADMIN → ${ownerId}`);
      summary.membersCreated++;
      if (!dryRun) {
        await prisma.financeMember.upsert({
          where: { userId_householdId: { userId: ownerId, householdId: h.id } },
          create: { userId: ownerId, householdId: h.id, role: "ADMIN" },
          update: {}, // nunca baja un rol existente
        });
      }
    }
  }

  // ── 3: cada usuario necesita su finanza PERSONAL ────────────────────────────
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  for (const u of users) {
    const own = await prisma.household.findFirst({ where: { ownerUserId: u.id, kind: "PERSONAL" } });
    // En dry-run el paso 1 no escribió: un usuario que sería dueño de su hogar actual no necesita Personal nueva.
    const wouldOwnCurrent = dryRun && households.some((h) => h.id === u.householdId && !h.ownerUserId
      && (h.users.find((x) => x.role === "ADMIN") ?? h.users[0])?.id === u.id);
    if (own || wouldOwnCurrent) continue;

    log(`usuario ${u.name}: crea finanza Personal y reapunta householdId`);
    summary.personalsCreated++;
    summary.membersCreated++;
    summary.usersRepointed++;
    if (dryRun) continue;

    const created = await prisma.household.create({
      data: {
        name: `Personal de ${u.name}`,
        type: "PERSONAL",
        kind: "PERSONAL",
        ownerUserId: u.id,
        members: { create: { userId: u.id, role: "ADMIN" } },
      },
    });
    await prisma.user.update({ where: { id: u.id }, data: { householdId: created.id } });
    if (ensureDefaults) await ensureDefaults(created.id);
  }

  return summary;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  // Imports dinámicos: el cliente y server.ts se cargan después de dotenv.
  const { prisma } = await import("../../src/lib/prisma");
  const { ensurePlanDefaults } = await import("../../src/lib/plan/server");

  const host = (process.env.DATABASE_URL ?? "").replace(/^.*@/, "").replace(/[/?].*$/, "");
  console.log(`Backfill S1 ${dryRun ? "(DRY RUN) " : ""}→ ${host || "(sin DATABASE_URL)"}`);

  const s = await runBackfill(prisma, { dryRun, log: (m) => console.log("  " + m), ensureDefaults: ensurePlanDefaults });
  console.log(
    `\nResumen${dryRun ? " (nada escrito)" : ""}: hogares con dueño nuevo ${s.householdsOwned}, ` +
    `miembros creados ${s.membersCreated}, personales creadas ${s.personalsCreated}, usuarios reapuntados ${s.usersRepointed}`,
  );
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
