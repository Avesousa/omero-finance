import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/plan/access";
import { ApiError, type ApiContext } from "@/lib/plan/server";
import type { CardMovementDTO } from "@/lib/plan/account-types";

const day = (d: Date | null | undefined) => d?.toISOString().slice(0, 10) ?? null;

/** Compras y resúmenes de una tarjeta propia o de una finanza a la que se tiene acceso. Si el dueño perdió el acceso, se enmascara el detalle. */
export async function cardMovements(ctx: ApiContext, cardId: string): Promise<CardMovementDTO[]> {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) throw new ApiError("Tarjeta no encontrada", 404);
  const readable = await canAccess({ id: ctx.userId }, card, "read");
  if (!readable && card.ownerUserId !== ctx.userId) await ctx.assert(card, "read");

  const [purchases, statements] = await Promise.all([
    prisma.planCardPurchase.findMany({ where: { cardId }, orderBy: { createdAt: "desc" } }),
    prisma.planCardStatement.findMany({ where: { cardId }, orderBy: { period: "desc" } }),
  ]);
  const out: CardMovementDTO[] = [];
  for (const p of purchases) {
    out.push({
      id: p.id, type: "PURCHASE", name: readable ? p.description : "Compra", masked: !readable,
      detail: readable && p.installments > 1 ? `${p.installments} cuotas desde ${p.firstPeriod}` : null,
      amount: -Number(p.amount), currency: p.currency, date: day(p.purchaseDate) ?? p.firstPeriod, isPaid: null,
    });
  }
  for (const s of statements) {
    const detail = s.isPaid ? "Pagado" : s.dueDate ? `Impago · vence ${day(s.dueDate)}` : "Impago";
    out.push({ id: s.id, type: "STATEMENT", name: `Resumen ${s.period}`, detail, amount: -Number(s.totalArs), currency: "ARS", date: day(s.dueDate) ?? s.period, isPaid: s.isPaid });
    if (s.usdAmount && Number(s.usdAmount) > 0) {
      out.push({ id: `${s.id}-usd`, type: "STATEMENT", name: `Resumen ${s.period} (USD)`, detail, amount: -Number(s.usdAmount), currency: "USD", date: day(s.dueDate) ?? s.period, isPaid: s.isPaid });
    }
  }
  return out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}
