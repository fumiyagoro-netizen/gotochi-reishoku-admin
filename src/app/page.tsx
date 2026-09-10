import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { resolveAwardId, resolveAwardYear } from "@/lib/award";
import { PRIZE_LEVELS, PRIZE_BADGE_CLASS, PRIZE_BAR_CLASS } from "@/lib/prize-shared";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, Upload } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export const metadata = { title: "ダッシュボード" };

interface Props {
  searchParams: Promise<{ year?: string }>;
}

// ルート直下に loading.tsx を置くと (public) 配下と /login まで同じ境界に包まれ、
// 公開ページの SSR にダッシュボードの骨組みが混ざる。そのためこのページだけは
// 自前の Suspense で骨組みを出し、集計クエリの完了を待たずに見出し位置を確保する。
export default function DashboardPage({ searchParams }: Props) {
  return (
    <PageContainer>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

// 集計クエリ待ちの間、統計4枚＋グラフ2枚の形を先に出す（旧 src/app/loading.tsx と同じ形）
function DashboardSkeleton() {
  return (
    <>
      <Skeleton className="mb-6 h-7 w-40" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CardSkeleton lines={1} />
        <CardSkeleton lines={1} />
        <CardSkeleton lines={1} />
        <CardSkeleton lines={1} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
      </div>
    </>
  );
}

async function Dashboard({ searchParams }: Props) {
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
    <>
      <PageHeader
        title="ダッシュボード"
        meta={year ? <Badge tone="neutral">{year}年度</Badge> : undefined}
      />

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="総エントリー数" value={totalEntries} />
        <StatCard label="企業数" value={companies.length} />
        <StatCard label="カテゴリ数" value={categories.length} />
        <StatCard label="受賞数" value={totalAwarded} href={`/awards${yearParam}`} />
      </div>

      {totalEntries === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="まだエントリーデータがありません"
            description="CSVをアップロードすると、集計がここに表示されます"
            action={
              <ButtonLink href={`/upload${yearParam}`} variant="primary" icon={<Upload />}>
                CSVをアップロード
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Prize Distribution */}
          {totalAwarded > 0 && (
            <Card padding="none">
              <CardHeader title="受賞内訳" />
              <div className="p-5">
                <div className="space-y-3">
                  {PRIZE_LEVELS.map((level) => {
                    const count = prizeCounts.find((p) => p.prizeLevel === level)?._count.id || 0;
                    if (count === 0) return null;
                    return (
                      <ProgressBar
                        key={level}
                        label={level}
                        value={count}
                        percent={Math.max((count / totalEntries) * 100, 8)}
                        fillClassName={PRIZE_BAR_CLASS[level]}
                      />
                    );
                  })}
                </div>

                {/* Category Prize Breakdown */}
                {Object.keys(categoryPrizeMap).length > 0 && (
                  <div className="mt-6 border-t border-line pt-4">
                    <h3 className="mb-3 text-sm font-medium text-ink">カテゴリ別受賞数</h3>
                    <div className="space-y-2">
                      {categories.map((cat) => {
                        const prizes = categoryPrizeMap[cat.productCategory];
                        if (!prizes) return null;
                        const catTotal = Object.values(prizes).reduce((s, n) => s + n, 0);
                        return (
                          <div key={cat.productCategory} className="flex items-center gap-3">
                            {/* 「その他: 具付き冷凍ラーメン」程度のカテゴリ名が切れない幅（12rem）。それより長いときだけ切り詰めて title で読める */}
                            <span
                              className="w-48 shrink-0 truncate text-sm text-ink-muted"
                              title={cat.productCategory || "未分類"}
                            >
                              {cat.productCategory || "未分類"}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {PRIZE_LEVELS.map((level) => {
                                const n = prizes[level];
                                if (!n) return null;
                                return (
                                  <Badge key={level} tone="custom" className={PRIZE_BADGE_CLASS[level]}>
                                    {level} {n}
                                  </Badge>
                                );
                              })}
                            </div>
                            <span className="ml-auto text-caption tabular-nums text-ink-subtle">
                              {catTotal}件
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Category Distribution */}
          <Card padding="none">
            <CardHeader title="カテゴリ別エントリー数" />
            <div className="space-y-3 p-5">
              {categories.map((cat) => (
                <ProgressBar
                  key={cat.productCategory}
                  label={cat.productCategory || "未分類"}
                  value={cat._count.id}
                  percent={Math.max((cat._count.id / totalEntries) * 100, 8)}
                />
              ))}
            </div>
          </Card>

          {/* Prefecture Distribution */}
          {prefectureCounts.length > 0 && (
            <Card padding="none" className="lg:col-span-2">
              <CardHeader title="ご当地（都道府県）別エントリー数" />
              <div className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-3 md:grid-cols-4">
                {prefectureCounts.map((pref) => (
                  <div
                    key={pref.prefecture}
                    className="flex items-center justify-between rounded-md bg-surface-muted px-3 py-2"
                  >
                    <span className="text-sm text-ink-muted">{pref.prefecture}</span>
                    <span className="text-sm font-semibold tabular-nums text-ink">
                      {pref._count.id}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
