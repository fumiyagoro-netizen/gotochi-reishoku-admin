import { prisma } from "@/lib/prisma";
import { resolveAwardId, resolveAwardYear } from "@/lib/award";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    prize?: string;
    page?: string;
    year?: string;
  }>;
}

const PRIZE_LEVELS = ["最高金賞", "金賞", "銀賞", "銅賞"];

const PRIZE_ORDER: Record<string, number> = {
  最高金賞: 1,
  金賞: 2,
  銀賞: 3,
  銅賞: 4,
};

const PRIZE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  最高金賞: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-300" },
  金賞: { bg: "bg-yellow-50", text: "text-yellow-800", border: "border-yellow-300" },
  銀賞: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-300" },
  銅賞: { bg: "bg-orange-50", text: "text-orange-800", border: "border-orange-300" },
};

const PAGE_SIZE = 20;

export default async function AwardsPage({ searchParams }: Props) {
  const params = await searchParams;
  const prizeFilter = params.prize || "";
  const page = Math.max(1, parseInt(params.page || "1"));
  const awardId = await resolveAwardId(params.year);
  const year = await resolveAwardYear(params.year);
  const yearParam = year ? `&year=${year}` : "";

  const where = {
    AND: [
      awardId ? { awardId } : {},
      { prizeLevel: prizeFilter ? prizeFilter : { not: "" } },
    ],
  };

  const [entries, total, prizeCounts] = await Promise.all([
    prisma.entry.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        images: {
          where: { imageType: "main" },
          take: 1,
        },
      },
    }),
    prisma.entry.count({ where }),
    prisma.entry.groupBy({
      by: ["prizeLevel"],
      where: {
        AND: [
          awardId ? { awardId } : {},
          { prizeLevel: { not: "" } },
        ],
      },
      _count: { id: true },
    }),
  ]);

  // Sort entries by prize level order
  const sortedEntries = [...entries].sort((a, b) => {
    const orderA = PRIZE_ORDER[a.prizeLevel] || 99;
    const orderB = PRIZE_ORDER[b.prizeLevel] || 99;
    return orderA - orderB;
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const totalAwarded = prizeCounts.reduce((sum, pc) => sum + pc._count.id, 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          受賞一覧
          <span className="text-base font-normal text-gray-500 ml-3">
            {total}件
          </span>
        </h2>
      </div>

      {/* Prize Level Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Link
          href={`/awards${year ? `?year=${year}` : ""}`}
          className={`px-4 py-3 rounded-xl border text-center transition-colors ${
            !prizeFilter
              ? "bg-blue-50 border-blue-300 text-blue-700"
              : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          <p className="text-2xl font-bold">{totalAwarded}</p>
          <p className="text-xs mt-0.5">すべて</p>
        </Link>
        {PRIZE_LEVELS.map((level) => {
          const count = prizeCounts.find((pc) => pc.prizeLevel === level)?._count.id || 0;
          const colors = PRIZE_COLORS[level];
          const isActive = prizeFilter === level;
          return (
            <Link
              key={level}
              href={`/awards?prize=${encodeURIComponent(level)}${yearParam}`}
              className={`px-4 py-3 rounded-xl border text-center transition-colors ${
                isActive
                  ? `${colors.bg} ${colors.border} ${colors.text}`
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs mt-0.5">{level}</p>
            </Link>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                写真
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                受賞
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                商品名
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                企業名
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                カテゴリ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedEntries.map((entry) => {
              const colors = PRIZE_COLORS[entry.prizeLevel] || {
                bg: "bg-gray-50",
                text: "text-gray-600",
                border: "border-gray-300",
              };
              return (
                <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    {entry.images[0] ? (
                      <img
                        src={`/api/images/${entry.images[0].id}`}
                        alt=""
                        className="w-12 h-12 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                        No img
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-3 py-1 ${colors.bg} ${colors.text} border ${colors.border} text-xs font-bold rounded-full`}
                    >
                      {entry.prizeLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/entries/${entry.id}${year ? `?year=${year}` : ""}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {entry.productName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {entry.companyName}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                      {entry.productCategory || "未分類"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {sortedEntries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  受賞エントリーがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {page > 1 && (
            <Link
              href={`/awards?prize=${encodeURIComponent(prizeFilter)}&page=${page - 1}${yearParam}`}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              前へ
            </Link>
          )}
          <span className="px-3 py-2 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/awards?prize=${encodeURIComponent(prizeFilter)}&page=${page + 1}${yearParam}`}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              次へ
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
