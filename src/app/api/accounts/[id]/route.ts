import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HOUSEHOLD_ID } from "../../../../../prisma/constants";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  // If setting as default, clear other defaults for this user first
  if (body.isDefault && body.userId) {
    await prisma.account.updateMany({
      where: { householdId: HOUSEHOLD_ID, userId: body.userId, isDefault: true, NOT: { id } },
      data: { isDefault: false },
    });
  }

  const account = await prisma.account.update({
    where: { id },
    data: {
      ...(body.name     !== undefined && { name:      body.name.trim() }),
      ...(body.type     !== undefined && { type:      body.type }),
      ...(body.currency !== undefined && { currency:  body.currency }),
      ...(body.balance  !== undefined && { balance:   parseFloat(body.balance) }),
      ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
      ...(body.userId   !== undefined && { userId:    body.userId }),
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

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.account.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
