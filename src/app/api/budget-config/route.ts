import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HOUSEHOLD_ID } from "../../../../prisma/constants";

const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

/** GET /api/budget-config?month=X&year=Y
 *  Returns config for the month. If none exists, falls back to the most
 *  recent previous month that has config (so new months inherit the last one).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month")!;
  const year  = parseInt(searchParams.get("year")!, 10);

  // Try the requested month first
  let configs = await prisma.budgetConfig.findMany({
    where: { householdId: HOUSEHOLD_ID, month, year },
  });

  let inherited = false;

  // Fall back: find the most recent month with any config
  if (configs.length === 0) {
    const monthIdx = MONTH_NAMES.indexOf(month);

    // Build list of (month, year) pairs going backwards up to 12 months
    const candidates: { month: string; year: number }[] = [];
    let m = monthIdx - 1;
    let y = year;
    for (let i = 0; i < 12; i++) {
      if (m < 0) { m = 11; y--; }
      candidates.push({ month: MONTH_NAMES[m], year: y });
      m--;
    }

    for (const c of candidates) {
      const prev = await prisma.budgetConfig.findMany({
        where: { householdId: HOUSEHOLD_ID, month: c.month, year: c.year },
      });
      if (prev.length > 0) {
        configs   = prev;
        inherited = true;
        break;
      }
    }
  }

  return NextResponse.json({
    configs: configs.map((c) => ({
      category:         c.category,
      manualPercentage: c.manualPercentage ? Number(c.manualPercentage) : null,
      manualAmount:     c.manualAmount     ? Number(c.manualAmount)     : null,
      isReserved:       c.isReserved,
    })),
    inherited,
  });
}

/** POST /api/budget-config
 *  Upserts all category configs for a given month/year.
 *  Body: { month, year, entries: [{ category, manualPercentage?, manualAmount?, isReserved }] }
 */
export async function POST(req: Request) {
  try {
    const { month, year, entries } = await req.json();
    if (!month || !year || !Array.isArray(entries)) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    await Promise.all(
      entries.map((e: {
        category: string;
        manualPercentage?: number | null;
        manualAmount?: number | null;
        isReserved?: boolean;
      }) =>
        prisma.budgetConfig.upsert({
          where: {
            householdId_month_year_category: {
              householdId: HOUSEHOLD_ID,
              month,
              year,
              category: e.category as never,
            },
          },
          update: {
            manualPercentage: e.manualPercentage ?? null,
            manualAmount:     e.manualAmount     ?? null,
            isReserved:       e.isReserved       ?? true,
          },
          create: {
            householdId:      HOUSEHOLD_ID,
            month,
            year,
            category:         e.category as never,
            manualPercentage: e.manualPercentage ?? null,
            manualAmount:     e.manualAmount     ?? null,
            isReserved:       e.isReserved       ?? true,
          },
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/budget-config POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
