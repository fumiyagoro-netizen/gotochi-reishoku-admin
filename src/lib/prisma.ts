import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Use Neon's serverless driver (WebSocket) instead of a raw TCP/pooler connection.
// On Vercel's serverless runtime, standard TCP connections to Neon were timing out
// on cold invocations (all /api routes hung). The serverless driver establishes
// connections fast and reliably; interactive transactions remain supported.
// `ws` supplies a WebSocket implementation for Node runtimes without a global one.
neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
