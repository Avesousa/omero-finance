/**
 * prisma/seed.ts — arranque de una base vacía: el hogar, los usuarios y el catálogo de tarjetas.
 * Todo lo demás (categorías, meses, presupuesto) lo crea Plan simple la primera vez que se usa.
 *
 * Run:  npx prisma db seed
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();

import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// eslint-disable-next-line @typescript-eslint/no-require-imports
neonConfig.webSocketConstructor = require("ws");

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma  = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

import { HOUSEHOLD_ID, AVELINO_ID, MARIA_ID } from "./constants";
export { HOUSEHOLD_ID, AVELINO_ID, MARIA_ID };

async function main() {
  const passwordHash = await bcrypt.hash("omero123", 10);

  await prisma.household.upsert({
    where:  { id: HOUSEHOLD_ID },
    update: { type: "SHARED" },
    create: { id: HOUSEHOLD_ID, name: "Casa Figueira", type: "SHARED" },
  });

  await prisma.user.upsert({
    where:  { id: AVELINO_ID },
    update: {},
    create: {
      id: AVELINO_ID, householdId: HOUSEHOLD_ID,
      name: "Avelino", email: "avelino@omero.local",
      passwordHash, role: "ADMIN", avatarColor: "#6366F1",
    },
  });
  await prisma.user.upsert({
    where:  { id: MARIA_ID },
    update: {},
    create: {
      id: MARIA_ID, householdId: HOUSEHOLD_ID,
      name: "Maria", email: "maria@omero.local",
      passwordHash, role: "MEMBER", avatarColor: "#EC4899",
    },
  });
  console.log("✓ Hogar y usuarios");

  const KNOWN_CARDS = [
    "VISA MARIA BBVA",
    "VISA MARIA CP",
    "VISA AVELINO BN",
    "MC AVELINO BN",
    "VISA AVELINO BK",
    "MC AVELINO MP",
  ];
  for (const name of KNOWN_CARDS) {
    const exists = await prisma.card.findFirst({ where: { householdId: HOUSEHOLD_ID, name } });
    if (!exists) await prisma.card.create({ data: { householdId: HOUSEHOLD_ID, name } });
  }
  console.log("✓ Tarjetas");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
