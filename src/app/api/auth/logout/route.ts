import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession(req);

  if (session) {
    await prisma.session.deleteMany({ where: { token: session.token } });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("omero_session", "", { maxAge: 0, path: "/" });
  return res;
}
