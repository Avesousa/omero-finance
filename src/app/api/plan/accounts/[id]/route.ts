import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_TYPES, accountBalance, accountDTO, accountMovements, assertAccount } from "@/lib/plan/accounts";
import { ApiError, readBody, v, withSession } from "@/lib/plan/server";
type Params = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, { params }: Params) {
 return withSession(req, "read", async (ctx) => { const { id } = await params; const a = await assertAccount(ctx, id); return NextResponse.json({ account: await accountDTO(a, ctx.userId), movements: await accountMovements(ctx, id) }); });
}
export async function PATCH(req: NextRequest, { params }: Params) {
 return withSession(req, "update", async (ctx) => {
  const { id } = await params; const a = await assertAccount(ctx, id, true); const b = await readBody(req);
  if (b.currency !== undefined && b.currency !== a.currency) throw new ApiError("La moneda de una cuenta no se cambia; creá otra cuenta");
  if (b.isArchived === true && await accountBalance(id) !== 0 && b.confirm !== true) throw new ApiError("La cuenta tiene saldo. Confirmá para archivarla.", 409);
  const data: Record<string, unknown> = {};
  if (b.name !== undefined) data.name = v.text(b.name, "Nombre");
  if (b.type !== undefined) data.type = v.oneOf(b.type, ACCOUNT_TYPES, "Tipo");
  if (b.isArchived !== undefined) data.isArchived = b.isArchived === true;
  if (b.openingBalance !== undefined) { const n = Number(b.openingBalance); if (!Number.isFinite(n) || Math.abs(n) >= 1e12) throw new ApiError("Saldo inválido"); data.openingBalance = n; }
  if (b.openingDate !== undefined) data.openingDate = v.optionalDate(b.openingDate);
  await prisma.planAccount.update({ where: { id }, data }); return NextResponse.json({ ok: true });
 });
}
export async function DELETE(req: NextRequest, { params }: Params) {
 return withSession(req, "delete", async (ctx) => {
  const { id } = await params; await assertAccount(ctx, id, true);
  const a = await prisma.planAccount.findUniqueOrThrow({ where: { id }, include: { _count: { select: { entries: true, transfersIn: true, transfersOut: true, payments: true } } } });
  if (Object.values(a._count).some(Boolean)) throw new ApiError("La cuenta tiene movimientos, archivala", 409);
  await prisma.planAccount.delete({ where: { id } }); return NextResponse.json({ ok: true });
 });
}
