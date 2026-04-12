import { NextRequest, NextResponse } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return unauthorized();
  return NextResponse.json({ user: session.user });
}
