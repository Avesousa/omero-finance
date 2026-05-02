import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireSession, unauthorized } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return unauthorized();
  }

  try {
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "La contraseña nueva debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return unauthorized();

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 401 });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: session.user.id },
      data:  { passwordHash: hash },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/auth/password PATCH]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
