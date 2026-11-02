import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { roleIn } from "@/lib/plan/access";
import { listFinancesFor, moveEntriesTx } from "@/lib/plan/finances";
import { ApiError, ensurePlanDefaults, readBody, v, withSession } from "@/lib/plan/server";

const MAX_ENTRIES = 200;

/**
 * POST /api/plan/entries/move — mueve movimientos de una finanza a otra.
 * Body: { entryIds: string[] (1..200), toFinanceId }
 * Necesita `update` en el origen y `create` en el destino (EDITOR+ en ambas); si falta en una, no se mueve nada.
 * Los fijos y las cuotas de préstamo no se mueven: vuelven en `skipped` con el motivo.
 */
export async function POST(req: NextRequest) {
  return withSession(req, "update", async (ctx) => {
    const body = await readBody(req);
    if (!Array.isArray(body.entryIds) || body.entryIds.length === 0 || body.entryIds.some((x) => typeof x !== "string")) {
      throw new ApiError("Faltan los movimientos");
    }
    const entryIds = [...new Set(body.entryIds as string[])];
    if (entryIds.length > MAX_ENTRIES) throw new ApiError(`Máximo ${MAX_ENTRIES} por vez`, 422);
    const toFinanceId = v.text(body.toFinanceId, "La finanza de destino", 60);

    // Se cargan sin filtro de finanza; las de finanzas ajenas se tratan como inexistentes (no se filtra su existencia).
    const rows = await prisma.planEntry.findMany({ where: { id: { in: entryIds } }, select: { id: true, householdId: true } });
    const roleByFinance = new Map<string, boolean>();
    const visible: typeof rows = [];
    for (const row of rows) {
      if (!roleByFinance.has(row.householdId)) {
        const finance = await prisma.household.findUnique({ where: { id: row.householdId }, select: { id: true, ownerUserId: true } });
        roleByFinance.set(row.householdId, !!finance && (await roleIn(ctx.userId, finance)) !== null);
      }
      if (roleByFinance.get(row.householdId)) visible.push(row);
    }
    const visibleIds = new Set(visible.map((r) => r.id));
    const unseen = entryIds.filter((id) => !visibleIds.has(id)).map((id) => ({ id, reason: "No encontrado" }));

    const sources = [...new Set(visible.map((r) => r.householdId))];
    if (sources.length === 0) throw new ApiError("No hay movimientos para mover", 422);
    if (sources.length > 1) throw new ApiError("Los movimientos tienen que ser de la misma finanza", 422);
    const fromId = sources[0];
    if (fromId === toFinanceId) throw new ApiError("Elegí otra finanza", 422);

    // Todo-o-nada: si falta permiso en cualquiera de los dos lados, no se mueve nada.
    await ctx.assert({ householdId: fromId }, "update");
    await ctx.assert({ householdId: toFinanceId }, "create");

    await ensurePlanDefaults(toFinanceId);
    const result = await moveEntriesTx({ entryIds: [...visibleIds], fromId, toId: toFinanceId });
    if (result.moved.length === 0) {
      throw new ApiError(result.skipped[0]?.reason ?? "No hay movimientos para mover", 422);
    }

    const finances = await listFinancesFor(ctx.userId);
    return NextResponse.json({
      moved: result.moved,
      skipped: [...result.skipped, ...unseen],
      from: finances.find((f) => f.id === fromId),
      to: finances.find((f) => f.id === toFinanceId),
    });
  });
}
