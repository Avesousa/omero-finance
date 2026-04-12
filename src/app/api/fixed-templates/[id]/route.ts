import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession(req);
  } catch {
    return unauthorized();
  }

  const { id } = await params;
  const body = await req.json();

  const t = await prisma.fixedExpenseTemplate.update({
    where: { id },
    data: {
      ...(body.concept  !== undefined && { concept:  body.concept.trim() }),
      ...(body.amount   !== undefined && { amount:   parseFloat(body.amount) }),
      ...(body.currency !== undefined && { currency: body.currency }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });

  return NextResponse.json({
    id:       t.id,
    concept:  t.concept,
    currency: t.currency,
    amount:   Number(t.amount),
    isActive: t.isActive,
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession(req);
  } catch {
    return unauthorized();
  }

  const { id } = await params;
  await prisma.fixedExpenseTemplate.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
