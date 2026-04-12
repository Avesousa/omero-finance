import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return unauthorized();
  }

  const { id } = await params;
  const body = await req.json();
  const { householdId } = session.user;

  if (body.isDefault && body.userId) {
    await prisma.account.updateMany({
      where: { householdId, userId: body.userId, isDefault: true, NOT: { id } },
      data: { isDefault: false },
    });
  }

  const account = await prisma.account.update({
    where: { id },
    data: {
      ...(body.name      !== undefined && { name:      body.name.trim() }),
      ...(body.type      !== undefined && { type:      body.type }),
      ...(body.currency  !== undefined && { currency:  body.currency }),
      ...(body.balance   !== undefined && { balance:   parseFloat(body.balance) }),
      ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
      ...(body.userId    !== undefined && { userId:    body.userId }),
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
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession(req);
  } catch {
    return unauthorized();
  }

  const { id } = await params;
  await prisma.account.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
