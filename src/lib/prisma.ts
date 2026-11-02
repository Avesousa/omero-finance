import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

// Use ws in Node.js environments (local dev, seed scripts)
if (typeof globalThis.WebSocket === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  neonConfig.webSocketConstructor = require("ws");
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function isLocalUrl(url: string | undefined): boolean {
  return !!url && /@(localhost|127\.0\.0\.1)(:|\/)/.test(url);
}

function createClient(): PrismaClient {
  // Desarrollo local: Postgres común (no hay proxy websocket de Neon). Nunca aplica a producción.
  if (isLocalUrl(process.env.DATABASE_URL)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg");
    return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) } as ConstructorParameters<typeof PrismaClient>[0]);
  }
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
