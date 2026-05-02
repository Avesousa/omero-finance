import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export async function PATCH(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return unauthorized();
  }

  try {
    const { avatarColor } = await req.json();

    if (!avatarColor || !HEX_COLOR_RE.test(avatarColor)) {
      return NextResponse.json({ error: "Color inválido (debe ser hex #RRGGBB)" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data:  { avatarColor },
    });

    return NextResponse.json({ ok: true, avatarColor });
  } catch (err) {
    console.error("[api/auth/avatar PATCH]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
