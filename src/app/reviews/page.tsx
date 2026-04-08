import { prisma } from "@/lib/prisma";
import { resolveAwardId, resolveAwardYear } from "@/lib/award";
import Link from "next/link";
import { ReviewNotifyButton } from "@/components/review-notify-button";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    status?: string;
    page?: string;
    year?: string;
  }>;
}

const REVIEW_STATUSES = [
  { value: "first_passed", label: "1次審査通過", icon: "①" },
  { value: "second_passed", label: "2次審査通過", icon: "②" },
];

const REVIEW_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  first_passed: { bg: "bg-green-50", text: "text-green-700", border: "border-green-300" },
  second_passed: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-300" },
};

const PAGE_SIZE = 20;

export default async function ReviewsPage({ searchParams }: Props) {
  const params = await searchParams;
  const statusFilter = params.status || "";
  const page = Math.max(1, parseInt(params.page || "1"));
  const awardId = await resolveAwardId(params.year);
  const year = await resolveAwardYear(params.year);
  const yearParam = year ? `&year=${year}` : "";

  // Use "contains" to match comma-separated values
  const where = {
    AND: [
      awardId ? { awardId } : {},
      statusFilter
        ? { reviewStatus: { contains: statusFilter } }
        : { reviewStatus: { not: "" } },
    ],
  };

  const awardWhere = awardId ? { awardId } : {};
  const [entries, total, firstCount, secondCount, allReviewed] = await Promise.all([
    prisma.entry.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { answeredAt: "desc" },
      include: {
        images: {
          where: { imageType: "main" },
          take: 1,
        },
      },
    }),
    prisma.entry.count({ where }),
    prisma.entry.count({
      where: { ...awardWhere, reviewStatus: { contains: "first_passed" } },
    }),
    prisma.entry.count({
      where: { ...awardWhere, reviewStatus: { contains: "second_passed" } },
    }),
    prisma.entry.count({
      where: { ...awardWhere, reviewStatus: { not: "" } },
    }),
  ]);

  const statusCountMap: Record<string, number> = {
    first_passed: firstCount,
    second_passed: secondCount,
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          審査状況
          <span className="text-base font-normal text-gray-500 ml-3">
            {total}件
          </span>
        </h2>
        {statusFilter && (
          <ReviewNotifyButton
            statusFilter={statusFilter}
            statusLabel={REVIEW_STATUSES.find((s) => s.value === statusFilter)?.label || ""}
            entryIds={entries.map((e) => e.id)}
          />
        )}
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Link
          href={`/reviews${year ? `?year=${year}` : ""}`}
          className={`px-4 py-3 rounded-xl border text-center transition-colors ${
            !statusFilter
              ? "bg-blue-50 border-blue-300 text-blue-700"
              : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          <p className="text-2xl font-bold">{allReviewed}</p>
          <p className="text-xs mt-0.5">すべて</p>
        </Link>
        {REVIEW_STATUSES.map((rs) => {
          const count = statusCountMap[rs.value] || 0;
          const colors = REVIEW_COLORS[rs.value];
          const isActive = statusFilter === rs.value;
          return (
            <Link
              key={rs.value}
              href={`/reviews?status=${rs.value}${yearParam}`}
              className={`px-4 py-3 rounded-xl border text-center transition-colors ${
                isActive
                  ? `${colors.bg} ${colors.border} ${colors.text}`
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs mt-0.5">{rs.icon} {rs.label}</p>
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
                審査状況
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
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                受賞
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.map((entry) => {
              const activeStatuses = entry.reviewStatus
                ? entry.reviewStatus.split(",").filter(Boolean)
                : [];
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
                    <div className="flex gap-1 flex-wrap">
                      {activeStatuses.map((s) => {
                        const rs = REVIEW_STATUSES.find((r) => r.value === s);
                        const colors = REVIEW_COLORS[s] || {
                          bg: "bg-gray-50",
                          text: "text-gray-600",
                          border: "border-gray-300",
                        };
                        return (
                          <span
                            key={s}
                            className={`inline-block px-3 py-1 ${colors.bg} ${colors.text} border ${colors.border} text-xs font-bold rounded-full`}
                          >
                            {rs?.icon} {rs?.label}
                          </span>
                        );
                      })}
                    </div>
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
                  <td className="px-4 py-3">
                    {entry.prizeLevel && (
                      <span className="inline-block px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold rounded-full">
                        🏆 {entry.prizeLevel}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  審査通過エントリーがありません
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
              href={`/reviews?status=${encodeURIComponent(statusFilter)}&page=${page - 1}${yearParam}`}
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
              href={`/reviews?status=${encodeURIComponent(statusFilter)}&page=${page + 1}${yearParam}`}
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
