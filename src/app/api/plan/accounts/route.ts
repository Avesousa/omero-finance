import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_TYPES, listAccounts } from "@/lib/plan/accounts";
import { ApiError, readBody, v, withSession } from "@/lib/plan/server";
export async function GET(req: NextRequest) {
 return withSession(req, "read", async (ctx) => {
   const target = req.nextUrl.searchParams.get("financeId");
   if (target) { await ctx.assert({ householdId: target }, "read"); return NextResponse.json({ accounts: await listAccounts({ ...ctx, householdId: target }, true) }); }
   return NextResponse.json({ accounts: await listAccounts(ctx, req.nextUrl.searchParams.get("activeOnly") === "1") });
 });
}
export async function POST(req: NextRequest) {
 return withSession(req, "create", async (ctx) => {
  const b = await readBody(req);
  const householdId = b.householdId === undefined ? ctx.householdId : v.text(b.householdId, "Finanza");
  await ctx.assert({ householdId }, "create");
  const balance = b.openingBalance == null || b.openingBalance === "" ? 0 : Number(b.openingBalance);
  if (!Number.isFinite(balance) || Math.abs(balance) >= 1e12) throw new ApiError("Saldo inválido");
  const account = await prisma.planAccount.create({ data: { householdId, ownerUserId: ctx.userId, name: v.text(b.name, "Nombre"), type: v.oneOf(b.type ?? "BANK", ACCOUNT_TYPES, "Tipo"), currency: v.oneOf(b.currency ?? "ARS", ["ARS", "USD"] as const, "Moneda"), openingBalance: balance, openingDate: v.optionalDate(b.openingDate) } });
  return NextResponse.json({ id: account.id }, { status: 201 });
 });
}
