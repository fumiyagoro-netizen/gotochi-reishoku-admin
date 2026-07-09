import { NextResponse } from "next/server";

// Public, no-auth, NO-database endpoint. If this responds but /api/diag hangs,
// the problem is database-specific; if this also hangs, all serverless functions
// are failing to execute on the platform. Safe to remove after the outage.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    region: process.env.VERCEL_REGION || process.env.NOW_REGION || "unknown",
    ts: Date.now(),
  });
}
