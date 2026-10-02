import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return unauthorized();
  }

  try {
    const body = await req.json();
    const name  = body.name?.trim();
    const email = body.email?.toLowerCase().trim();

    if (!name && !email) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    if (email) {
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken && taken.id !== session.user.id) {
        return NextResponse.json({ error: "El email ya está en uso" }, { status: 409 });
      }
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name  && { name }),
        ...(email && { email }),
      },
    });

    return NextResponse.json({ ok: true, name: updated.name, email: updated.email });
  } catch (err) {
    console.error("[api/auth/profile PATCH]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
