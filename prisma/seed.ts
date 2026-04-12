/**
 * prisma/seed.ts  — datos reales del spreadsheet "Presupuesto de casa.xlsx"
 * Meses: octubre-2025, noviembre-2025, diciembre-2025, enero-2026
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

// ─── Exchange rates (blue/informal, from spreadsheet TDC dates) ────────────
const RATES: Record<string, number> = {
  "octubre-2025":   1_424.144,
  "noviembre-2025": 1_405.057,
  "diciembre-2025": 1_452.999,
  "enero-2026":     1_477.202,
};

// ─── Income per month (ARS) — from Ingresos sheet ─────────────────────────
// Only SUELDO entries per person (other types seeded separately below).
const INCOME: Record<string, { avelino: number; maria: number }> = {
  "octubre-2025":   { avelino: 4_484_269.93 + 235_000, maria:   798_364.00 },
  "noviembre-2025": { avelino: 3_970_397.37 + 235_000, maria:   925_100.00 },
  "diciembre-2025": { avelino: 4_271_853.09 + 235_000, maria:   930_881.24 },
  "enero-2026":     { avelino: 4_152_957.22 + 235_000, maria:   957_250.40 },
};

// ─── Rent (alquiler + expensas 1G only, i.e. household cost) ──────────────
const RENT: Record<string, { alquiler: number; expensas: number }> = {
  "octubre-2025":   { alquiler:  579_630.00, expensas:  220_144.00 },
  "noviembre-2025": { alquiler:  579_630.00, expensas:  467_529.00 },
  "diciembre-2025": { alquiler:  666_409.00, expensas:  322_521.34 },
  "enero-2026":     { alquiler:  666_409.00, expensas:  428_988.00 },
};

// ─── TDC per card per month ────────────────────────────────────────────────
type CardEntry = { cardName: string; amount: number };
const TDC: Record<string, CardEntry[]> = {
  "octubre-2025": [
    { cardName: "VISA MARIA CP",   amount:  266_019.03 },
    { cardName: "VISA MARIA BBVA", amount:  678_961.88 },
    { cardName: "VISA AVELINO BN", amount:  747_054.00 },
    { cardName: "MC AVELINO BN",   amount: 1_448_840.00 },
    { cardName: "VISA AVELINO BK", amount:   70_509.08 },
  ],
  "noviembre-2025": [
    { cardName: "VISA MARIA CP",   amount:  237_717.85 },
    { cardName: "VISA MARIA BBVA", amount: 1_200_000.00 },
    { cardName: "VISA AVELINO BN", amount:  300_000.00 },
    { cardName: "MC AVELINO BN",   amount: 1_136_830.00 },
    { cardName: "VISA AVELINO BK", amount:   45_000.00 },
    { cardName: "MC AVELINO MP",   amount:  657_813.40 },
  ],
  "diciembre-2025": [
    { cardName: "VISA MARIA CP",   amount:  139_572.68 },
    { cardName: "VISA MARIA BBVA", amount: 1_090_310.51 },
    { cardName: "VISA AVELINO BN", amount:  747_813.00 },
    { cardName: "MC AVELINO BN",   amount:  892_260.00 },
    { cardName: "VISA AVELINO BK", amount:  157_532.73 },
    { cardName: "MC AVELINO MP",   amount:  374_342.42 },
  ],
  "enero-2026": [
    { cardName: "VISA AVELINO BK", amount:   97_347.64 },
    { cardName: "VISA MARIA CP",   amount:  316_705.88 },
    { cardName: "VISA MARIA BBVA", amount: 2_305_578.66 },
    { cardName: "VISA AVELINO BN", amount:  500_000.00 },
    { cardName: "MC AVELINO BN",   amount: 2_101_511.84 },
    { cardName: "MC AVELINO MP",   amount:  800_000.00 },
  ],
};

// ─── Fixed expenses per month (from Gasto fijos — enero-2026 is complete) ─
type FixedEntry = { concept: string; amount: number };
const FIXED: Record<string, FixedEntry[]> = {
  "octubre-2025": [
    // No historical snapshot — using approximate estimates
    { concept: "LUZ 1G",       amount:  50_000 },
    { concept: "Teléfono",     amount:  80_000 },
    { concept: "Gimnasio",     amount:  60_000 },
    { concept: "Suscripciones",amount:  30_000 },
  ],
  "noviembre-2025": [
    { concept: "LUZ 1G",       amount:  55_000 },
    { concept: "Teléfono",     amount:  85_000 },
    { concept: "Gimnasio",     amount:  65_000 },
    { concept: "Suscripciones",amount:  30_000 },
  ],
  "diciembre-2025": [
    { concept: "LUZ 1G",       amount:  60_000 },
    { concept: "Teléfono",     amount:  90_000 },
    { concept: "Gimnasio",     amount:  70_000 },
    { concept: "Suscripciones",amount:  35_000 },
  ],
  "enero-2026": [
    // Real data from Gasto fijos sheet
    { concept: "LUZ 1G",              amount:  79_082.54 },
    { concept: "Teléfono",            amount: 100_000.00 },
    { concept: "Auto",                amount: 473_000.00 },
    { concept: "MELI+",               amount:   7_298.88 },
    { concept: "Brubank",             amount:  29_900.00 },
    { concept: "Apple",               amount:   1_861.52 },
    { concept: "Gimnasio",            amount:  76_000.00 },
    { concept: "Consulta dientes",    amount: 112_500.00 },
    { concept: "Contador",            amount:  50_000.00 },
    { concept: "Limpieza 1era semana",amount:  25_000.00 },
    { concept: "Limpieza 3era semana",amount:  25_000.00 },
  ],
};

// ─── Grocery runs per month (from Gasto de mercado sheet) ─────────────────
type GroceryEntry = { description: string; amount: number };
const GROCERIES: Record<string, GroceryEntry[]> = {
  "octubre-2025": [
    { description: "Coto",                    amount: 163_612.51 },
    { description: "Jumbo",                   amount:  65_391.85 },
    { description: "Disco",                   amount:  18_864.65 },
    { description: "Disco (2da vuelta)",      amount:   9_706.83 },
    { description: "Carnicería",              amount:  32_287.80 },
    { description: "Panadería",               amount:  27_985.00 },
    { description: "Panadería (2da)",         amount:  11_983.00 },
    { description: "Panadería (3ra)",         amount:  32_410.00 },
    { description: "Panadería (4ta)",         amount:  22_252.00 },
    { description: "Matambre",                amount:  23_290.00 },
    { description: "Pollo",                   amount:  23_250.00 },
    { description: "Compra para sopa",        amount:  21_354.72 },
    { description: "Coto faltantes",          amount:  14_291.40 },
    { description: "Coto faltantes (2da)",    amount:  12_726.95 },
  ],
  "noviembre-2025": [],   // No data in spreadsheet
  "diciembre-2025": [
    { description: "Coto",             amount: 429_319.37 },
    { description: "Coto semana 20dic",amount: 187_845.28 },
    { description: "Jumbo",            amount: 140_631.30 },
    { description: "Compra Luis",      amount:   4_608.00 },
    { description: "Día",              amount:   1_790.00 },
  ],
  "enero-2026": [],  // No data in spreadsheet
};

// ─── Household general expenses ────────────────────────────────────────────
type HouseExpEntry = { description: string; amount: number; expenseType: "NECESSARY" | "UNNECESSARY" };
const HOUSEHOLD_EXPS: Record<string, HouseExpEntry[]> = {
  "octubre-2025": [
    { description: "Compra iPhone",      amount: 538_530.00, expenseType: "UNNECESSARY" },
    { description: "Padel",              amount:  96_000.00, expenseType: "UNNECESSARY" },
    { description: "Embajada",           amount: 150_000.00, expenseType: "NECESSARY"   },
    { description: "Pedidos Ya",         amount:  39_799.00, expenseType: "UNNECESSARY" },
    { description: "Desayuno/Almuerzo",  amount:  23_700.00, expenseType: "UNNECESSARY" },
    { description: "Pizza",              amount:  27_400.00, expenseType: "UNNECESSARY" },
    { description: "Merienda",           amount:  22_700.00, expenseType: "UNNECESSARY" },
    { description: "Subway",             amount:  13_300.00, expenseType: "UNNECESSARY" },
    { description: "Peluquería",         amount:  14_000.00, expenseType: "NECESSARY"   },
    { description: "Helado",             amount:  12_408.00, expenseType: "UNNECESSARY" },
    { description: "Kiosco",             amount:  21_400.00, expenseType: "UNNECESSARY" },
    { description: "Monster",            amount:   5_000.00, expenseType: "UNNECESSARY" },
    { description: "Hielo",              amount:  12_000.00, expenseType: "UNNECESSARY" },
    { description: "Bebidas concierto",  amount:  13_200.00, expenseType: "UNNECESSARY" },
    { description: "Uber",               amount:   8_000.00, expenseType: "NECESSARY"   },
    { description: "McDonalds",          amount:  46_200.00, expenseType: "UNNECESSARY" },
    { description: "Kiosco Maria",       amount:  11_400.00, expenseType: "UNNECESSARY" },
    { description: "Havanna",            amount:   4_600.00, expenseType: "UNNECESSARY" },
    { description: "Pedidos Ya (Maria)", amount:   8_619.00, expenseType: "UNNECESSARY" },
  ],
  "noviembre-2025": [],  // No data in spreadsheet
  "diciembre-2025": [
    { description: "Gastos MP hasta 21/12", amount: 113_646.02, expenseType: "UNNECESSARY" },
    { description: "Gastos en efectivo",    amount: 199_600.00, expenseType: "UNNECESSARY" },
    { description: "Gastos en efectivo 2",  amount:  27_226.57, expenseType: "UNNECESSARY" },
    { description: "Autopista",             amount:  14_166.38, expenseType: "NECESSARY"   },
  ],
  "enero-2026": [],  // No data in spreadsheet
};

// ─── Personal expenses ─────────────────────────────────────────────────────
type PersonalEntry = { userId: string; concept: string; amount: number };
const PERSONAL: Record<string, PersonalEntry[]> = {
  "octubre-2025": [
    { userId: AVELINO_ID, concept: "Alquiler Papá",  amount: 200_000.00 },
    { userId: MARIA_ID,   concept: "Uñas",            amount:  35_000.00 },
    { userId: MARIA_ID,   concept: "SUBE",             amount:  20_000.00 },
  ],
  "noviembre-2025": [
    { userId: AVELINO_ID, concept: "Alquiler Papá",  amount: 240_000.00 },
    { userId: MARIA_ID,   concept: "Uñas",            amount:  35_000.00 },
    { userId: MARIA_ID,   concept: "SUBE",             amount:  30_000.00 },
  ],
  "diciembre-2025": [
    { userId: MARIA_ID,   concept: "Gastos propios",      amount:  11_470.00 },
    { userId: AVELINO_ID, concept: "Gastos propios",      amount: 544_568.66 },
    { userId: MARIA_ID,   concept: "Resguardo",           amount:  76_000.00 },
    { userId: MARIA_ID,   concept: "Papá de María",       amount:  30_750.00 },
    { userId: AVELINO_ID, concept: "Papá de Avelino",     amount:  30_750.00 },
    { userId: AVELINO_ID, concept: "Contador (préstamo)", amount:  80_000.00 },
  ],
  "enero-2026": [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────
function parseMonth(key: string): { month: string; year: number } {
  const parts = key.split("-");
  const year  = parseInt(parts[parts.length - 1], 10);
  const month = parts.slice(0, -1).join("-");
  return { month, year };
}

const MONTH_IDX: Record<string, number> = {
  enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,
  julio:6,agosto:7,septiembre:8,octubre:9,noviembre:10,diciembre:11,
};

function rateDate(key: string): Date {
  const { month, year } = parseMonth(key);
  return new Date(year, MONTH_IDX[month], 15);
}

function dueDate(month: string, year: number): Date {
  const nextMonthIdx = (MONTH_IDX[month] + 1) % 12;
  const nextYear     = MONTH_IDX[month] === 11 ? year + 1 : year;
  return new Date(nextYear, nextMonthIdx, 10);
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const passwordHash = await bcrypt.hash("omero123", 10);

  // 1. Household
  await prisma.household.upsert({
    where:  { id: HOUSEHOLD_ID },
    update: { type: "SHARED" },
    create: { id: HOUSEHOLD_ID, name: "Casa Figueira", type: "SHARED" },
  });

  // 2. Users
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
  console.log("✓ Household and users");

  // 3. Card catalog
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
  console.log("✓ Card catalog");

  // 4. Fixed expense templates
  const FIXED_TEMPLATES = [
    { concept: "Alquiler",          amount: 450_000, sortOrder: 0 },
    { concept: "Expensas",          amount:  80_000, sortOrder: 1 },
    { concept: "Luz",               amount:  25_000, sortOrder: 2 },
    { concept: "Teléfono",          amount:  15_000, sortOrder: 3 },
    { concept: "Auto",              amount:  45_000, sortOrder: 4 },
    { concept: "MELI+",             amount:   8_000, sortOrder: 5 },
    { concept: "Brubank",           amount:   5_000, sortOrder: 6 },
    { concept: "Apple",             amount:   3_000, sortOrder: 7 },
    { concept: "Gimnasio",          amount:  12_000, sortOrder: 8 },
    { concept: "Limpieza",          amount:  20_000, sortOrder: 9 },
  ];
  for (const t of FIXED_TEMPLATES) {
    const existing = await prisma.fixedExpenseTemplate.findFirst({
      where: { householdId: HOUSEHOLD_ID, concept: t.concept },
    });
    if (!existing) {
      await prisma.fixedExpenseTemplate.create({
        data: { householdId: HOUSEHOLD_ID, ...t },
      });
    }
  }
  console.log("✓ Fixed expense templates");

  // 3. Exchange rates
  for (const [key, rate] of Object.entries(RATES)) {
    const date = rateDate(key);
    await prisma.exchangeRate.upsert({
      where:  { date },
      update: { usdArs: rate },
      create: { householdId: HOUSEHOLD_ID, date, usdArs: rate, source: "MANUAL" },
    });
  }
  console.log("✓ Exchange rates");

  // 4. Per-month data
  for (const key of Object.keys(INCOME)) {
    const { month, year } = parseMonth(key);
    const rate = RATES[key];

    // Income
    await upsertIncome(month, year, AVELINO_ID, INCOME[key].avelino);
    await upsertIncome(month, year, MARIA_ID,   INCOME[key].maria);

    // Rent — two separate rows (alquiler + expensas)
    await prisma.rentPayment.deleteMany({ where: { householdId: HOUSEHOLD_ID, month, year } });
    const rent = RENT[key];
    await prisma.rentPayment.create({
      data: { householdId: HOUSEHOLD_ID, createdById: AVELINO_ID, month, year,
              type: "ALQUILER", apartment: "Depto 1G", currency: "ARS", amount: rent.alquiler },
    });
    if (rent.expensas > 0) {
      await prisma.rentPayment.create({
        data: { householdId: HOUSEHOLD_ID, createdById: AVELINO_ID, month, year,
                type: "EXPENSAS", apartment: "Depto 1G", currency: "ARS", amount: rent.expensas },
      });
    }

    // TDC — one row per card
    await prisma.creditCardStatement.deleteMany({ where: { householdId: HOUSEHOLD_ID, month, year } });
    for (const card of TDC[key] ?? []) {
      await prisma.creditCardStatement.create({
        data: {
          householdId: HOUSEHOLD_ID, createdById: AVELINO_ID, month, year,
          cardName: card.cardName, dueDate: dueDate(month, year),
          totalAmountArs: card.amount, amountToPay: card.amount,
          dollarRateSnapshot: rate,
        },
      });
    }

    // Fixed expenses
    await prisma.fixedExpense.deleteMany({ where: { householdId: HOUSEHOLD_ID, month, year } });
    for (const fe of FIXED[key] ?? []) {
      await prisma.fixedExpense.create({
        data: { householdId: HOUSEHOLD_ID, createdById: AVELINO_ID, month, year,
                concept: fe.concept, currency: "ARS", amount: fe.amount },
      });
    }

    // Groceries
    await prisma.groceryExpense.deleteMany({ where: { householdId: HOUSEHOLD_ID, month, year } });
    for (const gr of GROCERIES[key] ?? []) {
      await prisma.groceryExpense.create({
        data: { householdId: HOUSEHOLD_ID, createdById: AVELINO_ID, month, year,
                description: gr.description, currency: "ARS", amount: gr.amount },
      });
    }

    // Household general expenses
    await prisma.householdExpense.deleteMany({ where: { householdId: HOUSEHOLD_ID, month, year } });
    for (const he of HOUSEHOLD_EXPS[key] ?? []) {
      await prisma.householdExpense.create({
        data: { householdId: HOUSEHOLD_ID, createdById: AVELINO_ID, month, year,
                description: he.description, expenseType: he.expenseType,
                currency: "ARS", amount: he.amount },
      });
    }

    // Personal expenses
    await prisma.personalExpense.deleteMany({ where: { householdId: HOUSEHOLD_ID, month, year } });
    for (const pe of PERSONAL[key] ?? []) {
      await prisma.personalExpense.create({
        data: { householdId: HOUSEHOLD_ID, userId: pe.userId, createdById: pe.userId,
                month, year, concept: pe.concept, currency: "ARS", amount: pe.amount },
      });
    }

    const tdcTotal = (TDC[key] ?? []).reduce((s, c) => s + c.amount, 0);
    const groTotal = (GROCERIES[key] ?? []).reduce((s, g) => s + g.amount, 0);
    const heTotal  = (HOUSEHOLD_EXPS[key] ?? []).reduce((s, h) => s + h.amount, 0);
    console.log(`✓ ${key}  — income ${fmt(INCOME[key].avelino + INCOME[key].maria)}  TDC ${fmt(tdcTotal)}  mercado ${fmt(groTotal)}  gastos ${fmt(heTotal)}`);
  }

  console.log("\n✅  Seed complete.");
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

async function upsertIncome(month: string, year: number, userId: string, amount: number) {
  const existing = await prisma.income.findFirst({
    where: { householdId: HOUSEHOLD_ID, month, year, createdById: userId, type: "SUELDO" },
  });
  if (existing) {
    await prisma.income.update({ where: { id: existing.id }, data: { amount } });
  } else {
    await prisma.income.create({
      data: { householdId: HOUSEHOLD_ID, createdById: userId, month, year,
              type: "SUELDO", currency: "ARS", amount },
    });
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
