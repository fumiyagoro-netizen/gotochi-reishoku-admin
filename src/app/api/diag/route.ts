import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public, no-auth diagnostic endpoint. Reports the function's execution region
// and whether it can reach the database, so connectivity can be checked with a
// plain curl (no login). Safe to remove once the outage is resolved.
export const dynamic = "force-dynamic";

export async function GET() {
  const region =
    process.env.VERCEL_REGION || process.env.NOW_REGION || "unknown";
  const t0 = Date.now();
  try {
    const count = await Promise.race([
      prisma.contact.count(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("db query timed out after 12s")), 12000)
      ),
    ]);
    return NextResponse.json({
      ok: true,
      region,
      dbMs: Date.now() - t0,
      contactCount: count,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        region,
        dbMs: Date.now() - t0,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 200 }
    );
  }
}
