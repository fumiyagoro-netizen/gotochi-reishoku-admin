import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Neon's pooled (-pooler) endpoint uses PgBouncer transaction pooling. On Vercel's
// serverless runtime many function instances each open a connection pool; without a
// small per-instance connection_limit they can exceed the pooler's client limit and
// new queries hang forever waiting for a connection (no error, just no response).
// - connection_limit=1 keeps each serverless instance to a single connection
// - pgbouncer=true disables prepared statements (required for transaction pooling)
// - pool_timeout surfaces a clear error instead of hanging if a connection can't be had
function serverlessDbUrl(url?: string): string | undefined {
  if (!url) return url;
  if (url.includes("pgbouncer=") || url.includes("connection_limit=")) return url;
  const params = "pgbouncer=true&connection_limit=1&pool_timeout=20";
  return url + (url.includes("?") ? "&" : "?") + params;
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasourceUrl: serverlessDbUrl(process.env.DATABASE_URL),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
