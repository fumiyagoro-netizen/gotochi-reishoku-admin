import { PrismaClient } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { SITE_PUBLIC_MODELS, SITE_PUBLIC_TAG } from "@/lib/site-cache";

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

const WRITE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
]);

function createClient() {
  return new PrismaClient({
    datasourceUrl: withConnectTimeout(process.env.DATABASE_URL),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // 請求状況（管理者だけに見せる）の手動の印は、エントリーを読むどの画面でも既定では読まない。
    // エントリーを丸ごとブラウザへ渡す画面が多いため。使う所だけ select / omit: false で明示して読む
    omit: { entry: { invoiceMarkedAt: true } },
  }).$extends({
    // 公開サイトが読むモデルに書き込んだら、ためておいた公開サイトの表示内容を捨てる（src/lib/site-cache.ts）。
    // 画面ごとに忘れず呼ぶのではなく、書き込みの出口1か所で必ず捨てる
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(args);
          if (WRITE_OPERATIONS.has(operation) && SITE_PUBLIC_MODELS.has(model)) {
            try {
              revalidateTag(SITE_PUBLIC_TAG);
            } catch {
              // Next.js のリクエストの外（scripts/ の手作業スクリプト等）では捨てられない。最大10分で読み直される
            }
          }
          return result;
        },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as { prisma: ReturnType<typeof createClient> };

export const prisma = globalForPrisma.prisma || createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
