import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const SESSION_DAYS = 30;

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son requeridos" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { household: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

    await prisma.session.create({
      data: { userId: user.id, token, expiresAt },
    });

    const responseData = {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        householdId: user.householdId,
        householdType: user.household.type,
        role: user.role,
        avatarColor: user.avatarColor,
      },
    };

    const res = NextResponse.json(responseData, { status: 200 });

    res.cookies.set("omero_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_DAYS * 24 * 60 * 60,
      path: "/",
    });

    return res;
  } catch (err) {
    console.error("[api/auth/login]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
