/**
 * prisma/seed.ts
 * Seeds household, users, exchange rates, and monthly data.
 *
 * Income/expense amounts for oct–dic 2024 are ESTIMATES.
 * Update them with real values from the spreadsheet.
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

// ─── Exchange rates (blue/informal, approximate) ───────────────────────────
const RATES: Record<string, number> = {
  "octubre-2024":   1_010.00,
  "noviembre-2024": 1_080.00,
  "diciembre-2024": 1_150.00,
  "enero-2026":     1_477.20,
};

// ─── Income per month (ARS) ────────────────────────────────────────────────
// enero-2026 values are from the mock; earlier months are estimates.
// ⚠️  Update oct–dic 2024 with actual spreadsheet values.
const INCOME: Record<string, { avelino: number; maria: number }> = {
  "octubre-2024":   { avelino: 2_600_000, maria:   580_000 },
  "noviembre-2024": { avelino: 2_900_000, maria:   640_000 },
  "diciembre-2024": { avelino: 3_500_000, maria:   800_000 },
  "enero-2026":     { avelino: 4_387_957, maria:   957_250 },
};

// ─── Rent per month (ARS) ─────────────────────────────────────────────────
// ⚠️  Update with actual values.
const RENT: Record<string, number> = {
  "octubre-2024":   780_000,
  "noviembre-2024": 820_000,
  "diciembre-2024": 900_000,
  "enero-2026":     1_095_397,
};

// ─── TDC total per month (ARS, to pay) ────────────────────────────────────
// ⚠️  Update with actual per-card values if needed.
const TDC: Record<string, number> = {
  "octubre-2024":   3_200_000,
  "noviembre-2024": 3_800_000,
  "diciembre-2024": 5_100_000,
  "enero-2026":     5_321_144,
};

// ─── Fixed expenses per month (concept → amount ARS) ─────────────────────
// ⚠️  Update with actual values.
const FIXED: Record<string, { concept: string; amount: number }[]> = {
  "octubre-2024": [
    { concept: "Prepaga OSDE", amount: 45_000 },
    { concept: "Netflix",       amount:  7_298 },
    { concept: "Spotify",       amount:  3_500 },
  ],
  "noviembre-2024": [
    { concept: "Prepaga OSDE", amount: 50_000 },
    { concept: "Netflix",       amount:  7_298 },
    { concept: "Spotify",       amount:  3_500 },
  ],
  "diciembre-2024": [
    { concept: "Prepaga OSDE", amount: 55_000 },
    { concept: "Netflix",       amount:  7_298 },
    { concept: "Spotify",       amount:  3_500 },
  ],
  "enero-2026": [
    { concept: "Prepaga OSDE", amount: 65_000 },
    { concept: "Netflix",       amount:  7_298 },
    { concept: "Spotify",       amount:  3_500 },
    { concept: "Otros fijos",   amount:  3_285 },
  ],
};

// ─── Grocery runs per month ───────────────────────────────────────────────
// ⚠️  Update with actual ticket-level data.
const GROCERIES: Record<string, { description: string; amount: number }[]> = {
  "octubre-2024": [
    { description: "Coto",  amount: 280_000 },
    { description: "Jumbo", amount: 180_000 },
  ],
  "noviembre-2024": [
    { description: "Coto",  amount: 300_000 },
    { description: "Jumbo", amount: 200_000 },
  ],
  "diciembre-2024": [
    { description: "Coto",  amount: 350_000 },
    { description: "Jumbo", amount: 250_000 },
  ],
  "enero-2026": [
    { description: "Coto",   amount: 320_000 },
    { description: "Jumbo",  amount: 280_000 },
    { description: "Carrefour", amount: 163_862 },
  ],
};

// ─── Household general expenses per month ────────────────────────────────
// ⚠️  Update with actual values.
const HOUSEHOLD_EXPS: Record<string, { description: string; amount: number; expenseType: "NECESSARY" | "UNNECESSARY" }[]> = {
  "octubre-2024": [
    { description: "Farmacia",   amount:  25_000, expenseType: "NECESSARY" },
    { description: "Varios",     amount:  50_000, expenseType: "UNNECESSARY" },
  ],
  "noviembre-2024": [
    { description: "Farmacia",   amount:  28_000, expenseType: "NECESSARY" },
    { description: "Salidas",    amount:  80_000, expenseType: "UNNECESSARY" },
  ],
  "diciembre-2024": [
    { description: "Farmacia",   amount:  30_000, expenseType: "NECESSARY" },
    { description: "Fiestas",    amount: 120_000, expenseType: "UNNECESSARY" },
  ],
  "enero-2026": [
    { description: "Farmacia",   amount:  45_000, expenseType: "NECESSARY" },
    { description: "Uber",       amount:  35_000, expenseType: "UNNECESSARY" },
    { description: "Restaurant", amount:  40_000, expenseType: "UNNECESSARY" },
    { description: "Varios",     amount:  33_646, expenseType: "UNNECESSARY" },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────
function parseMonth(key: string): { month: string; year: number } {
  const [month, yearStr] = key.split("-");
  return { month, year: parseInt(yearStr, 10) };
}

function rateDate(key: string): Date {
  const { month, year } = parseMonth(key);
  const idx = [
    "enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre",
  ].indexOf(month);
  return new Date(year, idx, 15); // mid-month snapshot
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const passwordHash = await bcrypt.hash("omero123", 10);

  // 1. Household
  await prisma.household.upsert({
    where:  { id: HOUSEHOLD_ID },
    update: {},
    create: { id: HOUSEHOLD_ID, name: "Casa Figueira" },
  });

  // 2. Users
  await prisma.user.upsert({
    where:  { id: AVELINO_ID },
    update: {},
    create: {
      id:           AVELINO_ID,
      householdId:  HOUSEHOLD_ID,
      name:         "Avelino",
      email:        "avelino@omero.local",
      passwordHash,
      role:         "ADMIN",
      avatarColor:  "#6366F1",
    },
  });
  await prisma.user.upsert({
    where:  { id: MARIA_ID },
    update: {},
    create: {
      id:           MARIA_ID,
      householdId:  HOUSEHOLD_ID,
      name:         "Maria",
      email:        "maria@omero.local",
      passwordHash,
      role:         "MEMBER",
      avatarColor:  "#EC4899",
    },
  });

  console.log("✓ Household and users seeded");

  // 3. Exchange rates
  for (const [key, rate] of Object.entries(RATES)) {
    const date = rateDate(key);
    await prisma.exchangeRate.upsert({
      where:  { date },
      update: { usdArs: rate },
      create: { householdId: HOUSEHOLD_ID, date, usdArs: rate, source: "MANUAL" },
    });
  }
  console.log("✓ Exchange rates seeded");

  // 4. Per-month data
  for (const key of Object.keys(INCOME)) {
    const { month, year } = parseMonth(key);
    const rate = RATES[key];
    const income = INCOME[key];

    // 4a. Income
    await upsertIncome(month, year, AVELINO_ID, income.avelino);
    await upsertIncome(month, year, MARIA_ID,   income.maria);

    // 4b. Rent
    await prisma.rentPayment.deleteMany({
      where: { householdId: HOUSEHOLD_ID, month, year, type: "ALQUILER" },
    });
    await prisma.rentPayment.create({
      data: {
        householdId: HOUSEHOLD_ID,
        createdById: AVELINO_ID,
        month,
        year,
        type:       "ALQUILER",
        apartment:  "Depto principal",
        currency:   "ARS",
        amount:     RENT[key],
      },
    });

    // 4c. TDC statement (single summary card per month)
    await prisma.creditCardStatement.deleteMany({
      where: { householdId: HOUSEHOLD_ID, month, year, cardName: "RESUMEN TOTAL" },
    });
    await prisma.creditCardStatement.create({
      data: {
        householdId:   HOUSEHOLD_ID,
        createdById:   AVELINO_ID,
        month,
        year,
        cardName:      "RESUMEN TOTAL",
        dueDate:       new Date(year === 2026 ? 2026 : 2024, ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"].indexOf(month) + 1, 10),
        totalAmountArs: TDC[key],
        amountToPay:   TDC[key],
        dollarRateSnapshot: rate,
      },
    });

    // 4d. Fixed expenses
    await prisma.fixedExpense.deleteMany({
      where: { householdId: HOUSEHOLD_ID, month, year },
    });
    for (const fe of FIXED[key] ?? []) {
      await prisma.fixedExpense.create({
        data: {
          householdId: HOUSEHOLD_ID,
          createdById: AVELINO_ID,
          month,
          year,
          concept:    fe.concept,
          currency:   "ARS",
          amount:     fe.amount,
        },
      });
    }

    // 4e. Groceries
    await prisma.groceryExpense.deleteMany({
      where: { householdId: HOUSEHOLD_ID, month, year },
    });
    for (const gr of GROCERIES[key] ?? []) {
      await prisma.groceryExpense.create({
        data: {
          householdId: HOUSEHOLD_ID,
          createdById: AVELINO_ID,
          month,
          year,
          description: gr.description,
          currency:    "ARS",
          amount:      gr.amount,
        },
      });
    }

    // 4f. Household general expenses
    await prisma.householdExpense.deleteMany({
      where: { householdId: HOUSEHOLD_ID, month, year },
    });
    for (const he of HOUSEHOLD_EXPS[key] ?? []) {
      await prisma.householdExpense.create({
        data: {
          householdId: HOUSEHOLD_ID,
          createdById: AVELINO_ID,
          month,
          year,
          description: he.description,
          expenseType: he.expenseType,
          currency:    "ARS",
          amount:      he.amount,
        },
      });
    }

    console.log(`✓ ${key} seeded`);
  }

  console.log("\n✅  Seed complete. Run 'npx prisma studio' to inspect data.");
  console.log("⚠️   Remember to update oct–dic 2024 amounts with real spreadsheet values.");
}

async function upsertIncome(month: string, year: number, userId: string, amount: number) {
  const existing = await prisma.income.findFirst({
    where: { householdId: HOUSEHOLD_ID, month, year, createdById: userId, type: "SUELDO" },
  });
  if (existing) {
    await prisma.income.update({ where: { id: existing.id }, data: { amount } });
  } else {
    await prisma.income.create({
      data: {
        householdId: HOUSEHOLD_ID,
        createdById: userId,
        month,
        year,
        type:     "SUELDO",
        currency: "ARS",
        amount,
      },
    });
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
