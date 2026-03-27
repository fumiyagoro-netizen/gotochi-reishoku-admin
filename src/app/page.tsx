import { prisma } from "@/lib/prisma";
import { resolveAwardId, resolveAwardYear } from "@/lib/award";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PRIZE_COLORS: Record<string, { bg: string; text: string }> = {
  最高金賞: { bg: "bg-amber-100", text: "text-amber-800" },
  金賞: { bg: "bg-yellow-100", text: "text-yellow-800" },
  銀賞: { bg: "bg-gray-200", text: "text-gray-700" },
  銅賞: { bg: "bg-orange-100", text: "text-orange-800" },
};

interface Props {
  searchParams: Promise<{ year?: string }>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const awardId = await resolveAwardId(params.year);
  const year = await resolveAwardYear(params.year);
  const where = awardId ? { awardId } : {};

  const [totalEntries, categories, companies, prizeCounts, categoryPrizeCounts, prefectureCounts] =
    await Promise.all([
      prisma.entry.count({ where }),
      prisma.entry.groupBy({
        by: ["productCategory"],
        where,
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      prisma.entry.groupBy({
        by: ["companyName"],
        where,
        _count: { id: true },
      }),
      prisma.entry.groupBy({
        by: ["prizeLevel"],
        where: { ...where, prizeLevel: { not: "" } },
        _count: { id: true },
      }),
      prisma.entry.groupBy({
        by: ["productCategory", "prizeLevel"],
        where: { ...where, prizeLevel: { not: "" } },
        _count: { id: true },
      }),
      prisma.entry.groupBy({
        by: ["prefecture"],
        where: { ...where, prefecture: { not: "" } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
    ]);

  const totalAwarded = prizeCounts.reduce((sum, p) => sum + p._count.id, 0);
  const yearParam = year ? `?year=${year}` : "";

  // Build category prize map
  const categoryPrizeMap: Record<string, Record<string, number>> = {};
  for (const cp of categoryPrizeCounts) {
    if (!categoryPrizeMap[cp.productCategory]) categoryPrizeMap[cp.productCategory] = {};
    categoryPrizeMap[cp.productCategory][cp.prizeLevel] = cp._count.id;
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-8">
        ダッシュボード
        {year && (
          <span className="text-base font-normal text-gray-500 ml-3">
            {year}年度
          </span>
        )}
      </h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">総エントリー数</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{totalEntries}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">企業数</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{companies.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">カテゴリ数</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{categories.length}</p>
        </div>
        <Link
          href={`/awards${yearParam}`}
          className="bg-white rounded-xl border border-gray-200 p-6 hover:bg-gray-50 transition-colors"
        >
          <p className="text-sm text-gray-500">🏆 受賞数</p>
          <p className="text-3xl font-bold text-amber-600 mt-2">{totalAwarded}</p>
        </Link>
      </div>

      {totalEntries === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 mb-4">まだエントリーデータがありません</p>
          <Link
            href={`/upload${yearParam}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            CSVをアップロード
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Prize Distribution */}
          {totalAwarded > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">受賞内訳</h3>
              <div className="space-y-3">
                {["最高金賞", "金賞", "銀賞", "銅賞"].map((level) => {
                  const count = prizeCounts.find((p) => p.prizeLevel === level)?._count.id || 0;
                  if (count === 0) return null;
                  const colors = PRIZE_COLORS[level];
                  return (
                    <div key={level} className="flex items-center gap-4">
                      <span className={`text-sm font-medium w-24 shrink-0 px-2 py-1 rounded-full text-center ${colors.bg} ${colors.text}`}>
                        {level}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                        <div
                          className={`${colors.bg} h-full rounded-full flex items-center justify-end pr-2`}
                          style={{
                            width: `${Math.max((count / totalEntries) * 100, 8)}%`,
                          }}
                        >
                          <span className={`text-xs font-bold ${colors.text}`}>{count}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Category Prize Breakdown */}
              {Object.keys(categoryPrizeMap).length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">カテゴリ別受賞数</h4>
                  <div className="space-y-2">
                    {categories.map((cat) => {
                      const prizes = categoryPrizeMap[cat.productCategory];
                      if (!prizes) return null;
                      const catTotal = Object.values(prizes).reduce((s, n) => s + n, 0);
                      return (
                        <div key={cat.productCategory} className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 w-28 shrink-0">
                            {cat.productCategory || "未分類"}
                          </span>
                          <div className="flex gap-1.5 flex-wrap">
                            {["最高金賞", "金賞", "銀賞", "銅賞"].map((level) => {
                              const n = prizes[level];
                              if (!n) return null;
                              const c = PRIZE_COLORS[level];
                              return (
                                <span key={level} className={`px-2 py-0.5 text-xs font-medium rounded-full ${c.bg} ${c.text}`}>
                                  {level} {n}
                                </span>
                              );
                            })}
                          </div>
                          <span className="text-xs text-gray-400 ml-auto">{catTotal}件</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Category Distribution */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">カテゴリ別エントリー数</h3>
            <div className="space-y-3">
              {categories.map((cat) => (
                <div key={cat.productCategory} className="flex items-center gap-4">
                  <span className="text-sm text-gray-700 w-28 shrink-0">
                    {cat.productCategory || "未分類"}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full flex items-center justify-end pr-2"
                      style={{
                        width: `${Math.max((cat._count.id / totalEntries) * 100, 8)}%`,
                      }}
                    >
                      <span className="text-xs text-white font-medium">{cat._count.id}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Prefecture Distribution */}
          {prefectureCounts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 lg:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">ご当地（都道府県）別エントリー数</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {prefectureCounts.map((pref) => (
                  <div key={pref.prefecture} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">{pref.prefecture}</span>
                    <span className="text-sm font-bold text-blue-600">{pref._count.id}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
