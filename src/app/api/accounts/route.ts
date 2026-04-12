import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return unauthorized();
  }

  const accounts = await prisma.account.findMany({
    where: { householdId: session.user.householdId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, avatarColor: true } } },
  });

  return NextResponse.json(
    accounts.map((a) => ({
      id:        a.id,
      name:      a.name,
      type:      a.type,
      currency:  a.currency,
      balance:   Number(a.balance),
      isDefault: a.isDefault,
      userId:    a.userId,
      user:      a.user,
    }))
  );
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return unauthorized();
  }

  const { name, type, currency, balance, userId } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  }

  const { householdId } = session.user;

  if (userId) {
    await prisma.account.updateMany({
      where: { householdId, userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const account = await prisma.account.create({
    data: {
      householdId,
      userId:    userId ?? null,
      name:      name.trim(),
      type:      type     ?? "CHECKING",
      currency:  currency ?? "ARS",
      balance:   parseFloat(balance ?? "0"),
      isDefault: !!userId,
    },
    include: { user: { select: { id: true, name: true, avatarColor: true } } },
  });

  return NextResponse.json({
    id:        account.id,
    name:      account.name,
    type:      account.type,
    currency:  account.currency,
    balance:   Number(account.balance),
    isDefault: account.isDefault,
    userId:    account.userId,
    user:      account.user,
  }, { status: 201 });
}
