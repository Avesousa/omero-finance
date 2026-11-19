import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const MIN_LENGTH = 8;

/**
 * Cambio de clave desde el login, sin sesión (para quien no se acuerda de la actual).
 *
 * OJO: por ahora NO verifica identidad; quien sepa el email puede cambiar la clave.
 * Es provisorio hasta sumar doble factor. Se apaga con `ALLOW_DIRECT_PASSWORD_RESET=false`.
 * Al cambiarla se cierran todas las sesiones abiertas de esa cuenta.
 */
export async function POST(req: NextRequest) {
  if (process.env.ALLOW_DIRECT_PASSWORD_RESET === "false") {
    return NextResponse.json({ error: "El cambio de clave desde el login está deshabilitado" }, { status: 403 });
  }

  try {
    const { email, newPassword } = await req.json();

    if (typeof email !== "string" || typeof newPassword !== "string" || !email.trim() || !newPassword) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }
    if (newPassword.length < MIN_LENGTH) {
      return NextResponse.json(
        { error: `La contraseña nueva debe tener al menos ${MIN_LENGTH} caracteres` },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      return NextResponse.json({ error: "No encontramos una cuenta con ese email" }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/auth/reset-password POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
