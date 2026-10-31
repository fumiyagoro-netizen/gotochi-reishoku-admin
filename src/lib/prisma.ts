import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * Neon は使われないと止まり、次の接続で起動する（数秒かかる）。Prisma の接続の待ち時間（既定5秒）が先に切れると
 * 「Can't reach database server」になる（2026-10-21 11:50 にトップページで発生）。Neon の Prisma 向けの案内どおり、
 * 接続文字列に connect_timeout=15 を足す。接続文字列に指定があればそちらを使う。
 */
function withConnectTimeout(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "15");
    return u.toString();
  } catch {
    return url;
  }
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasourceUrl: withConnectTimeout(process.env.DATABASE_URL),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // 請求状況（管理者だけに見せる）の手動の印は、エントリーを読むどの画面でも既定では読まない。
    // エントリーを丸ごとブラウザへ渡す画面が多いため。使う所だけ select / omit: false で明示して読む
    omit: { entry: { invoiceMarkedAt: true } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
