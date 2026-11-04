/**
 * Datos de prueba para desarrollo LOCAL (nunca producción): se niega a correr si DATABASE_URL no es localhost.
 *
 *   npx tsx scripts/seed-local.ts
 *
 * Deja a Avelino como estaba en producción antes de S1 (un hogar sin dueño), a Maria con su propio usuario,
 * algunos gastos del mes, y corre el backfill real para que Avelino quede como dueño de su Personal.
 * Ambos entran con la contraseña "omero123". Idempotente.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();

import bcrypt from "bcryptjs";
import { runBackfill } from "../prisma/backfill/finanzas-s1";

const PASSWORD = "omero123";

async function main() {
  if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(process.env.DATABASE_URL ?? "")) {
    throw new Error("seed-local solo corre contra una base local (DATABASE_URL no es localhost).");
  }
  const { prisma } = await import("../src/lib/prisma");
  const { ensurePlanDefaults } = await import("../src/lib/plan/server");
  const { currentPeriod } = await import("../src/lib/plan/core");
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const person = async (name: string, email: string) => {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return existing;
    // Estado previo a S1: un hogar sin dueño ni miembros.
    const home = await prisma.household.create({ data: { name: `Hogar de ${name}`, type: "PERSONAL" } });
    return prisma.user.create({ data: { name, email, passwordHash, householdId: home.id, role: "ADMIN" } });
  };
  const avelino = await person("Avelino", "avelino@omero.local");
  const maria = await person("Maria", "maria@omero.local");

  const summary = await runBackfill(prisma, { ensureDefaults: ensurePlanDefaults });

  // Gastos de ejemplo en la Personal de Avelino (solo si todavía no tiene movimientos).
  const own = await prisma.household.findFirstOrThrow({ where: { ownerUserId: avelino.id, kind: "PERSONAL" } });
  if ((await prisma.planEntry.count({ where: { householdId: own.id } })) === 0) {
    const period = currentPeriod();
    await ensurePlanDefaults(own.id);
    await prisma.planMonth.upsert({
      where: { householdId_period: { householdId: own.id, period } },
      create: { householdId: own.id, period, usdRate: 1200 },
      update: {},
    });
    const cats = await prisma.planCategory.findMany({ where: { householdId: own.id } });
    const cat = (n: string) => cats.find((c) => c.name === n)?.id ?? null;
    const today = new Date().toISOString().slice(0, 10);
    const rows: [string, number, string][] = [
      ["Cena en pareja", 38000, "Salidas y ocio"],
      ["Supermercado", 52000, "Supermercado"],
      ["Cine", 14000, "Salidas y ocio"],
      ["Farmacia", 9000, "Salud"],
      ["Nafta", 25000, "Transporte"],
    ];
    for (const [name, amount, category] of rows) {
      await prisma.planEntry.create({
        data: { householdId: own.id, period, kind: "EXPENSE", name, amount, categoryId: cat(category), date: new Date(today), isDone: true },
      });
    }
    await prisma.planEntry.create({
      data: { householdId: own.id, period, kind: "INCOME", name: "Sueldo", amount: 900000, categoryId: cat("Sueldo"), date: new Date(today), isDone: true },
    });
  }

  console.log(`Listo. Backfill: ${JSON.stringify(summary)}`);
  console.log(`  avelino@omero.local / ${PASSWORD}  (dueño de su Personal, con gastos de ejemplo)`);
  console.log(`  maria@omero.local   / ${PASSWORD}  (usuario nuevo, sin datos)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
