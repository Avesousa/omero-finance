import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  householdId: string;
  householdType: string;
  role: string;
  avatarColor: string;
};

export type AuthSession = {
  token: string;
  user: SessionUser;
};

async function findSession(token: string): Promise<AuthSession | null> {
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { household: true } } },
  });

  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return {
    token,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      householdId: session.user.householdId,
      householdType: session.user.household.type,
      role: session.user.role,
      avatarColor: session.user.avatarColor,
    },
  };
}

export async function getSession(req: NextRequest): Promise<AuthSession | null> {
  // Bearer token (mobile)
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return findSession(authHeader.slice(7));
  }

  // Cookie (web)
  const cookie = req.cookies.get("omero_session")?.value;
  if (cookie) return findSession(cookie);

  return null;
}

export async function requireSession(req: NextRequest): Promise<AuthSession> {
  const session = await getSession(req);
  if (!session) {
    throw new SessionError("No autorizado");
  }
  return session;
}

export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionError";
  }
}

/**
 * For use in Next.js Server Components and Server Actions.
 * Reads the session cookie via next/headers (no Request object needed).
 */
export async function getServerSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("omero_session")?.value;
  if (!token) return null;
  return findSession(token);
}

/** Utility to return a 401 response from any API route */
export function unauthorized() {
  return new Response(JSON.stringify({ error: "No autorizado" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
