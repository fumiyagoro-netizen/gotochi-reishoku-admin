import { prisma } from "@/lib/prisma";
import { resolveAwardId, resolveAwardYear } from "@/lib/award";
import Link from "next/link";
import { getCurrentRole, getPermissions } from "@/lib/role";
import { EntryTable } from "@/components/entry-table";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    q?: string;
    category?: string;
    page?: string;
    year?: string;
  }>;
}

const PAGE_SIZE = 20;

export default async function EntriesPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = params.q || "";
  const category = params.category || "";
  const page = Math.max(1, parseInt(params.page || "1"));
  const awardId = await resolveAwardId(params.year);
  const year = await resolveAwardYear(params.year);
  const yearParam = year ? `&year=${year}` : "";
  const role = await getCurrentRole();
  const perms = getPermissions(role);

  const where = {
    AND: [
      awardId ? { awardId } : {},
      q
        ? {
            OR: [
              { companyName: { contains: q } },
              { productName: { contains: q } },
              { contactLastName: { contains: q } },
              { contactFirstName: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {},
      category ? { productCategory: category } : {},
    ],
  };

  const [entries, total, categories] = await Promise.all([
    prisma.entry.findMany({
      where,
      orderBy: { answeredAt: "desc" },
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
      by: ["productCategory"],
      where: awardId ? { awardId } : {},
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          エントリー一覧
          <span className="text-base font-normal text-gray-500 ml-3">
            {total}件
          </span>
        </h2>
        {total > 0 && perms.canDownload && (
          <a
            href={`/api/entries/export${year ? `?year=${year}` : ""}`}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700
              hover:bg-gray-50 transition-colors"
          >
            📥 Excelダウンロード
          </a>
        )}
      </div>

      {/* Search & Filter */}
      <form className="flex gap-3 mb-6">
        {year && <input type="hidden" name="year" value={year} />}
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="企業名・商品名・担当者名で検索..."
          className="flex-1 max-w-md px-4 py-2.5 border border-gray-300 rounded-lg text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <select
          name="category"
          defaultValue={category}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全カテゴリ</option>
          {categories.map((cat) => (
            <option key={cat.productCategory} value={cat.productCategory}>
              {cat.productCategory || "未分類"} ({cat._count.id})
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium
            hover:bg-blue-700 transition-colors"
        >
          検索
        </button>
        {(q || category) && (
          <Link
            href={`/entries${year ? `?year=${year}` : ""}`}
            className="px-4 py-2.5 text-gray-600 border border-gray-300 rounded-lg text-sm
              hover:bg-gray-50 transition-colors"
          >
            クリア
          </Link>
        )}
      </form>

      {/* Entry Table with checkboxes */}
      <EntryTable entries={entries} year={year} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {page > 1 && (
            <Link
              href={`/entries?q=${q}&category=${category}&page=${page - 1}${yearParam}`}
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
              href={`/entries?q=${q}&category=${category}&page=${page + 1}${yearParam}`}
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
