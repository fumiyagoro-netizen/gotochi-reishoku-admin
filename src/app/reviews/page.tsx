import { prisma } from "@/lib/prisma";
import { resolveAwardId, resolveAwardYear } from "@/lib/award";
import Link from "next/link";
import { ItemArrivalBadge } from "@/components/item-arrival-selector";
import { REVIEW_LABELS, REVIEW_BADGE_CLASS, isReviewStatus } from "@/lib/review-status-shared";
import { isPrizeLevel } from "@/lib/prize-shared";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { FilterGroup, FilterTile } from "@/components/ui/filter-tile";
import { Table, Th, Td, Tr, Thumb } from "@/components/ui/table";
import { Badge, PrizeBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Ban, CircleCheck, ClipboardCheck } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export const metadata = { title: "審査状況" };

interface Props {
  searchParams: Promise<{
    status?: string;
    arrival?: string;
    page?: string;
    year?: string;
  }>;
}

// タイルの並びは 1次 → 2次 → 選外（review-status-shared.ts の配列順とは別）
const REVIEW_TILES = ["first_passed", "second_passed", "rejected"] as const;

// FilterTile の小さな点（Badge の hue と揃える。JIT のため完全なクラス文字列）
const REVIEW_DOT_CLASS: Record<(typeof REVIEW_TILES)[number], string> = {
  first_passed: "bg-emerald-400",
  second_passed: "bg-indigo-400",
  rejected: "bg-red-400",
};

// 商品到着の絞り込み値。second_arrived / final_arrived は Entry.itemArrivalStatus
// の値そのもの（contains 一致）。not_arrived だけはこのページ固有の合成値で、
// 「どちらのラベルも付いていない（itemArrivalStatus === ""）」に対応する —
// まだ商品が届いていない企業を洗い出す用途のための絞り込み。
const ARRIVAL_FILTERS = [
  { value: "second_arrived", label: "2次審査商品到着" },
  { value: "final_arrived", label: "最終審査商品到着" },
  { value: "not_arrived", label: "未到着" },
];

const ARRIVAL_DOT_CLASS: Record<string, string> = {
  second_arrived: "bg-sky-400",
  final_arrived: "bg-purple-400",
  not_arrived: "bg-zinc-400",
};

const PAGE_SIZE = 20;

// 表内リンク。Td primary の font-medium を引き継ぎ、色だけアクセントにする
const LINK_CLASS =
  "text-accent hover:underline rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

export default async function ReviewsPage({ searchParams }: Props) {
  const params = await searchParams;
  const statusFilter = params.status || "first_passed";
  const arrivalFilter = params.arrival || "";
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
      arrivalFilter === "second_arrived"
        ? { itemArrivalStatus: { contains: "second_arrived" } }
        : arrivalFilter === "final_arrived"
          ? { itemArrivalStatus: { contains: "final_arrived" } }
          : arrivalFilter === "not_arrived"
            ? { itemArrivalStatus: "" }
            : {},
    ],
  };

  const awardWhere = awardId ? { awardId } : {};
  const [
    entries,
    total,
    rejectedCount,
    firstCount,
    secondCount,
    secondArrivedCount,
    finalArrivedCount,
    notArrivedCount,
  ] = await Promise.all([
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
      where: { ...awardWhere, reviewStatus: { contains: "rejected" } },
    }),
    prisma.entry.count({
      where: { ...awardWhere, reviewStatus: { contains: "first_passed" } },
    }),
    prisma.entry.count({
      where: { ...awardWhere, reviewStatus: { contains: "second_passed" } },
    }),
    prisma.entry.count({
      where: { ...awardWhere, itemArrivalStatus: { contains: "second_arrived" } },
    }),
    prisma.entry.count({
      where: { ...awardWhere, itemArrivalStatus: { contains: "final_arrived" } },
    }),
    prisma.entry.count({
      where: { ...awardWhere, itemArrivalStatus: "" },
    }),
  ]);

  const statusCountMap: Record<string, number> = {
    rejected: rejectedCount,
    first_passed: firstCount,
    second_passed: secondCount,
  };

  // Same award-wide scope as statusCountMap above (not narrowed by the
  // currently selected statusFilter/arrivalFilter) — these are the totals
  // shown on the cards, while the table below applies both filters together.
  const arrivalCountMap: Record<string, number> = {
    second_arrived: secondArrivedCount,
    final_arrived: finalArrivedCount,
    not_arrived: notArrivedCount,
  };

  function arrivalHref(value: string) {
    const active = arrivalFilter === value;
    return `/reviews?status=${encodeURIComponent(statusFilter)}${active ? "" : `&arrival=${value}`}${yearParam}`;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <PageContainer>
      <PageHeader title="審査状況" count={total} />

      <div className="mb-6 space-y-4">
        {/* Status Summary Cards */}
        <FilterGroup label="審査状況" className="grid grid-cols-3 gap-3">
          {REVIEW_TILES.map((value) => (
            <FilterTile
              key={value}
              href={`/reviews?status=${value}${yearParam}`}
              active={statusFilter === value}
              label={REVIEW_LABELS[value]}
              count={statusCountMap[value] || 0}
              dotClassName={REVIEW_DOT_CLASS[value]}
            />
          ))}
        </FilterGroup>

        {/* Item Arrival Summary Cards — independent filter axis from review
            status above (see the `where.AND` combination), so a company can be
            isolated by e.g. "1次審査通過" AND "未到着" to chase up samples
            that still haven't arrived. */}
        <FilterGroup
          label="商品到着状況（同じタイルをもう一度押すと解除）"
          className="grid grid-cols-3 gap-3"
        >
          {ARRIVAL_FILTERS.map((af) => (
            <FilterTile
              key={af.value}
              href={arrivalHref(af.value)}
              active={arrivalFilter === af.value}
              label={af.label}
              count={arrivalCountMap[af.value] || 0}
              dotClassName={ARRIVAL_DOT_CLASS[af.value]}
            />
          ))}
        </FilterGroup>
      </div>

      {/* Table */}
      <Table>
        <thead>
          <tr>
            <Th width="w-16">写真</Th>
            <Th>審査状況</Th>
            <Th>商品到着</Th>
            <Th>商品名</Th>
            <Th>企業名</Th>
            <Th>カテゴリ</Th>
            <Th>受賞</Th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const activeStatuses = entry.reviewStatus
              ? entry.reviewStatus.split(",").filter(Boolean)
              : [];
            return (
              <Tr key={entry.id}>
                <Td>
                  <Thumb
                    src={entry.images[0] ? `/api/images/${entry.images[0].id}` : undefined}
                    alt=""
                  />
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {activeStatuses.map((s) =>
                      isReviewStatus(s) ? (
                        <Badge
                          key={s}
                          tone="custom"
                          className={REVIEW_BADGE_CLASS[s]}
                          icon={s === "rejected" ? <Ban /> : <CircleCheck />}
                        >
                          {REVIEW_LABELS[s]}
                        </Badge>
                      ) : (
                        // 未知の値は neutral ＋ 生文字列で落とさない
                        <Badge key={s} tone="neutral">
                          {s}
                        </Badge>
                      ),
                    )}
                  </div>
                </Td>
                <Td>
                  <ItemArrivalBadge status={entry.itemArrivalStatus} />
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
                <Td>
                  {/* 受賞があるときだけ。賞ごとの色にし、未知の賞名は neutral で見せる */}
                  {entry.prizeLevel &&
                    (isPrizeLevel(entry.prizeLevel) ? (
                      <PrizeBadge prizeLevel={entry.prizeLevel} />
                    ) : (
                      <Badge tone="neutral">{entry.prizeLevel}</Badge>
                    ))}
                </Td>
              </Tr>
            );
          })}
          {entries.length === 0 && (
            <EmptyState
              colSpan={7}
              icon={ClipboardCheck}
              title="審査通過エントリーがありません"
              description={
                arrivalFilter
                  ? "絞り込み条件に該当するエントリーはありません。到着タイルをもう一度押すと解除できます"
                  : "エントリー詳細の審査状況欄で設定すると、ここに表示されます"
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
        hrefFor={(n) =>
          `/reviews?status=${encodeURIComponent(statusFilter)}&page=${n}${arrivalFilter ? `&arrival=${arrivalFilter}` : ""}${yearParam}`
        }
      />
    </PageContainer>
  );
}
