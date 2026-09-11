import { prisma } from "@/lib/prisma";
import { resolveAwardId, resolveAwardYear } from "@/lib/award";
import Link from "next/link";
import { PRIZE_LEVELS, PRIZE_DOT_CLASS, GRAND_PRIX_TITLE, isPrizeLevel } from "@/lib/prize-shared";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { FilterTile } from "@/components/ui/filter-tile";
import { Table, Th, Td, Tr, Thumb } from "@/components/ui/table";
import { Badge, GrandPrixBadge, PrizeBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Trophy } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export const metadata = { title: "受賞一覧" };

interface Props {
  searchParams: Promise<{
    prize?: string;
    page?: string;
    year?: string;
  }>;
}

const PRIZE_ORDER: Record<string, number> = {
  最高金賞: 1,
  金賞: 2,
  銀賞: 3,
  銅賞: 4,
};

const PAGE_SIZE = 20;

// 表内リンク。Td primary の font-medium を引き継ぎ、色だけアクセントにする
const LINK_CLASS =
  "text-accent hover:underline rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

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
        titles: { where: { name: GRAND_PRIX_TITLE }, select: { id: true } },
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
    // 同じ賞の中ではグランプリを先頭に
    return orderA - orderB || b.titles.length - a.titles.length;
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const totalAwarded = prizeCounts.reduce((sum, pc) => sum + pc._count.id, 0);

  return (
    <PageContainer>
      <PageHeader title="受賞一覧" count={total} />

      {/* Prize Level Summary（絞り込みタイル。「すべて」は prizeFilter が空のとき active） */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <FilterTile
          href={`/awards${year ? `?year=${year}` : ""}`}
          active={!prizeFilter}
          label="すべて"
          count={totalAwarded}
        />
        {PRIZE_LEVELS.map((level) => {
          const count = prizeCounts.find((pc) => pc.prizeLevel === level)?._count.id || 0;
          return (
            <FilterTile
              key={level}
              href={`/awards?prize=${encodeURIComponent(level)}${yearParam}`}
              active={prizeFilter === level}
              label={level}
              count={count}
              dotClassName={PRIZE_DOT_CLASS[level]}
            />
          );
        })}
      </div>

      {/* Table */}
      <Table>
        <thead>
          <tr>
            <Th width="w-16">写真</Th>
            <Th>受賞</Th>
            <Th>商品名</Th>
            <Th>企業名</Th>
            <Th>カテゴリ</Th>
          </tr>
        </thead>
        <tbody>
          {sortedEntries.map((entry) => (
            <Tr key={entry.id}>
              <Td>
                <Thumb
                  src={entry.images[0] ? `/api/images/${entry.images[0].id}` : undefined}
                  alt=""
                />
              </Td>
              <Td>
                {/* 未知の賞名は neutral ＋ 生文字列で落とさない（既存のフォールバックと同じ） */}
                <div className="flex flex-wrap items-center gap-1">
                  {isPrizeLevel(entry.prizeLevel) ? (
                    <PrizeBadge prizeLevel={entry.prizeLevel} />
                  ) : (
                    <Badge tone="neutral">{entry.prizeLevel}</Badge>
                  )}
                  {entry.titles.length > 0 && <GrandPrixBadge />}
                </div>
              </Td>
              <Td primary>
                <Link
                  href={`/entries/${entry.id}${year ? `?year=${year}` : ""}`}
                  className={LINK_CLASS}
                >
                  {entry.productName}
                </Link>
              </Td>
              <Td>{entry.companyName}</Td>
              <Td>
                <Badge tone="neutral">{entry.productCategory || "未分類"}</Badge>
              </Td>
            </Tr>
          ))}
          {sortedEntries.length === 0 && (
            <EmptyState
              colSpan={5}
              icon={Trophy}
              title="受賞エントリーがありません"
              description={
                prizeFilter
                  ? "この賞に該当するエントリーはありません。「すべて」を押すと全ての受賞を表示します"
                  : "エントリー詳細の受賞欄で設定すると、ここに表示されます"
              }
            />
          )}
        </tbody>
      </Table>

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        hrefFor={(n) => `/awards?prize=${encodeURIComponent(prizeFilter)}&page=${n}${yearParam}`}
      />
    </PageContainer>
  );
}
