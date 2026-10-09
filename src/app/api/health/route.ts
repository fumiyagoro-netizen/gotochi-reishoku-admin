import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * 死活監視用（.github/workflows/uptime.yml が数分おきに呼ぶ）。
 * アプリが動いていて、データベースにつながるかだけを返す。中身のデータは何も返さない。
 */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers });
  }
}
