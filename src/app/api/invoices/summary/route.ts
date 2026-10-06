import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";

// GET: 年度ごとの請求金額の集計。請求書一覧（GET /api/invoices）の上に出す
// サマリー用で、あちらと違い year / q の絞り込みは受け取らない — 「どの年度を
// 見ていても全年度の売上が並ぶ」のがこの画面の目的なので、検索語でサマリーの
// 数字が動いてしまうと比較に使えない。
//
// 年度は Invoice.issueDate の暦年ではなく、紐づく Entry の Award.year で数える。
// 請求書一覧の年度絞り込み（resolveAwardId → entry.awardId）と同じ定義にして、
// 「サマリーの2027年度」と「一覧の2027年度」が必ず一致するようにするため。
// 実際、現在の請求書は全件が2027年度のエントリー宛で発行日は2026年なので、
// 暦年で数えると一覧と食い違う。
export async function GET(request: NextRequest) {
  const role = await getRoleFromRequest(request);
  const perms = getPermissions(role);
  if (!perms.canManageInvoices) {
    return NextResponse.json({ success: false, message: "閲覧権限がありません" }, { status: 403 });
  }

  try {
    const awards = await prisma.award.findMany({
      orderBy: { year: "desc" },
      select: { id: true, year: true },
    });

    // 年度数は1年に1件しか増えないので、年度ごとに集計クエリを投げる。
    // 請求書を全件引いて JS で足すより、請求書が増えても転送量が一定。
    const years = await Promise.all(
      awards.map(async (award) => {
        const where = { entry: { awardId: award.id } };
        const [agg, unsentCount] = await Promise.all([
          prisma.invoice.aggregate({
            where,
            _count: { _all: true },
            _sum: { subtotal: true, taxAmount: true, totalAmount: true },
          }),
          prisma.invoice.count({ where: { ...where, sentAt: null } }),
        ]);
        return {
          year: award.year,
          count: agg._count._all,
          // 請求書が0件の年度は _sum が null になるので 0 に寄せる
          subtotal: agg._sum.subtotal ?? 0,
          taxAmount: agg._sum.taxAmount ?? 0,
          totalAmount: agg._sum.totalAmount ?? 0,
          unsentCount,
        };
      })
    );

    const total = years.reduce(
      (acc, y) => ({
        count: acc.count + y.count,
        subtotal: acc.subtotal + y.subtotal,
        taxAmount: acc.taxAmount + y.taxAmount,
        totalAmount: acc.totalAmount + y.totalAmount,
        unsentCount: acc.unsentCount + y.unsentCount,
      }),
      { count: 0, subtotal: 0, taxAmount: 0, totalAmount: 0, unsentCount: 0 }
    );

    return NextResponse.json({ success: true, years, total });
  } catch (error) {
    console.error("Invoices summary GET error:", error);
    return NextResponse.json({ success: false, message: "集計の取得に失敗しました" }, { status: 500 });
  }
}
