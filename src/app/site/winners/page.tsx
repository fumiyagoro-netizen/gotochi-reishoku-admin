import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { FilterChip, FilterChipGroup } from "@/components/ui/filter-chip";
import { FilterTile } from "@/components/ui/filter-tile";
import { Table, Th, Td, Tr, Thumb } from "@/components/ui/table";
import { Badge, GrandPrixBadge, PrizeBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { ExternalLink, Trophy } from "@/components/ui/icons";
import { PRIZE_LEVELS, PRIZE_DOT_CLASS, GRAND_PRIX_TITLE, isPrizeLevel } from "@/lib/prize-shared";
import { utcToJstDateInputValue } from "@/lib/award-dates";
import { WinnersYearSettings } from "@/components/site/winners-year-settings";
import { SitePhotoPicker, SitePublishToggle } from "@/components/site/winner-row-actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "受賞商品の公開" };

// 受賞商品の公開（docs/site-migration/README.md §3〜4）。受賞の付いたエントリーを年度ごと・賞ごとに並べ、
// 年度の公開設定（受賞商品を公開／特別枠）と、商品ごとの公開・表示写真を決める。
// 表示ルールそのもの（どれがサイトに出るか）は公開サイト側で SiteAwardSettings と Entry.sitePublished を見る。

interface Props {
  searchParams: Promise<{ year?: string; prize?: string; needs?: string }>;
}

const LINK_CLASS =
  "rounded-md text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

function toPhotoIds(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((v): v is number => Number.isInteger(v)) : [];
}

export default async function SiteWinnersPage({ searchParams }: Props) {
  const params = await searchParams;

  const awards = await prisma.award.findMany({
    orderBy: { year: "desc" },
    select: {
      id: true,
      year: true,
      _count: { select: { entries: { where: { prizeLevel: { not: "" } } } } },
    },
  });
  const award =
    awards.find((a) => String(a.year) === params.year) ??
    awards.find((a) => a._count.entries > 0) ??
    awards[0];

  if (!award) {
    return (
      <PageContainer>
        <PageHeader title="受賞商品の公開" />
        <EmptyState icon={Trophy} title="年度がまだありません" description="年度管理で年度を作ると、ここに並びます" />
      </PageContainer>
    );
  }

  const [settings, otherFeatured, entries] = await Promise.all([
    prisma.siteAwardSettings.findUnique({ where: { awardId: award.id } }),
    prisma.siteAwardSettings.findFirst({
      where: { isFeatured: true, awardId: { not: award.id } },
      select: { award: { select: { year: true } } },
    }),
    prisma.entry.findMany({
      where: { awardId: award.id, prizeLevel: { not: "" } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        productName: true,
        companyName: true,
        prefecture: true,
        referenceUrl: true,
        prizeLevel: true,
        sitePublished: true,
        sitePhotoIds: true,
        images: { select: { id: true, imageType: true }, orderBy: { sortOrder: "asc" } },
        titles: { where: { name: GRAND_PRIX_TITLE }, select: { id: true } },
      },
    }),
  ]);

  // 要確認: サイトに出したとき欠けて見えるもの（写真なし・参考URLなし・都道府県なし）と、個別に非公開にしたもの
  const needsCheck = (e: (typeof entries)[number]) =>
    e.images.length === 0 || !e.referenceUrl || !e.prefecture || !e.sitePublished;

  const prizeFilter = isPrizeLevel(params.prize) ? params.prize : "";
  const needsOnly = params.needs === "1";
  const visible = entries.filter((e) => (!prizeFilter || e.prizeLevel === prizeFilter) && (!needsOnly || needsCheck(e)));

  const href = (o: { year?: number; prize?: string; needs?: boolean }) => {
    const sp = new URLSearchParams({ year: String(o.year ?? award.year) });
    if (o.prize) sp.set("prize", o.prize);
    if (o.needs) sp.set("needs", "1");
    return `/site/winners?${sp.toString()}`;
  };

  // 賞ごとのまとまり。既知の賞の順 → 未知の賞名はそのまま後ろに。同じ賞の中ではグランプリを先頭に
  const groups = [...PRIZE_LEVELS, ...new Set(visible.map((e) => e.prizeLevel).filter((p) => !isPrizeLevel(p)))]
    .map((level) => ({
      level,
      items: visible
        .filter((e) => e.prizeLevel === level)
        .sort((a, b) => b.titles.length - a.titles.length || a.id - b.id),
    }))
    .filter((g) => g.items.length > 0);

  const featuredUntil = utcToJstDateInputValue(settings?.featuredUntil);
  const featuredExpired =
    !!settings?.isFeatured && !!settings.featuredUntil && settings.featuredUntil.getTime() < Date.now();
  const publishedCount = entries.filter((e) => e.sitePublished).length;
  const needsCount = entries.filter(needsCheck).length;
  const COLS = 7;

  return (
    <PageContainer>
      <PageHeader
        title="受賞商品の公開"
        count={entries.length}
        countUnit="品"
        description="エントリー管理で受賞を付けた商品が、年度ごと・賞ごとに並びます。サイトに出すかどうかと、表示する写真をここで決めます。"
      />

      <div className="space-y-6">
        <FilterChipGroup>
          {awards.map((a) => (
            <FilterChip key={a.id} href={href({ year: a.year })} active={a.id === award.id} count={a._count.entries}>
              {a.year}年度
            </FilterChip>
          ))}
        </FilterChipGroup>

        <Alert tone="info" compact>
          公開サイトの切り替え前です。ここでの設定は、新しい公開サイトに切り替えたときに反映されます。
        </Alert>

        <WinnersYearSettings
          key={award.id}
          awardId={award.id}
          year={award.year}
          winnersPublished={settings?.winnersPublished ?? false}
          isFeatured={settings?.isFeatured ?? false}
          featuredUntil={featuredUntil}
          featuredExpired={featuredExpired}
          otherFeaturedYear={otherFeatured?.award.year ?? null}
          prizedCount={entries.length}
          publishedCount={publishedCount}
        />

        {entries.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="この年度の受賞はまだ付いていません"
            description="エントリー詳細の受賞欄で賞を付けると、ここに賞ごとに並びます"
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <FilterTile
                href={href({ needs: needsOnly })}
                active={!prizeFilter}
                label="すべて"
                count={entries.length}
              />
              {PRIZE_LEVELS.map((level) => (
                <FilterTile
                  key={level}
                  href={href({ prize: level, needs: needsOnly })}
                  active={prizeFilter === level}
                  label={level}
                  count={entries.filter((e) => e.prizeLevel === level).length}
                  dotClassName={PRIZE_DOT_CLASS[level]}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <FilterChip href={href({ prize: prizeFilter, needs: !needsOnly })} active={needsOnly} count={needsCount}>
                要確認のみ（写真・参考URL・都道府県が無い／非公開）
              </FilterChip>
              <p className="text-caption text-ink-subtle">
                サイトに公開 <span className="font-semibold tabular-nums text-ink">{publishedCount}</span> / {entries.length}品
              </p>
            </div>

            <Table>
              <thead>
                <tr>
                  <Th width="w-16">写真</Th>
                  <Th>商品名・企業名</Th>
                  <Th>都道府県</Th>
                  <Th>サイトに出す写真</Th>
                  <Th>参考URL</Th>
                  <Th>サイト</Th>
                  <Th srLabel="操作" />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <GroupRows key={g.level} level={g.level} items={g.items} year={award.year} cols={COLS} />
                ))}
                {groups.length === 0 && (
                  <EmptyState
                    colSpan={COLS}
                    icon={Trophy}
                    title="条件に合う商品がありません"
                    description="「すべて」を押すか「要確認のみ」を外すと、この年度の受賞商品をすべて表示します"
                  />
                )}
              </tbody>
            </Table>
          </>
        )}
      </div>
    </PageContainer>
  );
}

type Row = {
  id: number;
  productName: string;
  companyName: string;
  prefecture: string;
  referenceUrl: string;
  prizeLevel: string;
  sitePublished: boolean;
  sitePhotoIds: unknown;
  images: { id: number; imageType: string }[];
  titles: { id: number }[];
};

function GroupRows({ level, items, year, cols }: { level: string; items: Row[]; year: number; cols: number }) {
  return (
    <>
      <tr className="border-b border-line">
        <td colSpan={cols} className="bg-surface-muted/60 px-4 py-2">
          <span className="flex items-center gap-2">
            {isPrizeLevel(level) ? <PrizeBadge prizeLevel={level} /> : <Badge tone="neutral">{level}</Badge>}
            <span className="text-caption tabular-nums text-ink-subtle">{items.length}品</span>
          </span>
        </td>
      </tr>
      {items.map((e) => {
        const selected = toPhotoIds(e.sitePhotoIds).filter((id) => e.images.some((img) => img.id === id));
        const mainImage = e.images.find((img) => img.imageType === "main") ?? e.images[0];
        const thumbId = selected[0] ?? mainImage?.id;
        return (
          <Tr key={e.id} muted={!e.sitePublished}>
            <Td>
              <Thumb src={thumbId ? `/api/images/${thumbId}` : undefined} alt="" />
            </Td>
            <Td primary>
              <div className="flex flex-wrap items-center gap-1.5">
                <Link href={`/entries/${e.id}?year=${year}`} className={LINK_CLASS}>
                  {e.productName}
                </Link>
                {e.titles.length > 0 && <GrandPrixBadge size="sm" />}
              </div>
              <p className="text-caption font-normal text-ink-subtle">{e.companyName}</p>
            </Td>
            <Td nowrap>{e.prefecture || <Badge tone="outline" size="sm">未入力</Badge>}</Td>
            <Td nowrap>
              {e.images.length === 0 ? (
                <Badge tone="warning" size="sm">写真なし</Badge>
              ) : selected.length > 0 ? (
                <span className="tabular-nums">{selected.length} / 3枚</span>
              ) : (
                <span className="text-ink-subtle">自動（メイン1枚）</span>
              )}
            </Td>
            <Td nowrap>
              {e.referenceUrl ? (
                <a
                  href={e.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 ${LINK_CLASS}`}
                >
                  開く
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              ) : (
                <Badge tone="outline" size="sm">未入力</Badge>
              )}
            </Td>
            <Td nowrap>
              <SitePublishToggle entryId={e.id} productName={e.productName} published={e.sitePublished} />
            </Td>
            <Td nowrap className="text-right">
              <SitePhotoPicker
                entryId={e.id}
                productName={e.productName}
                images={e.images}
                selected={selected}
              />
            </Td>
          </Tr>
        );
      })}
    </>
  );
}
