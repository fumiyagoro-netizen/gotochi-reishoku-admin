import { prisma } from "@/lib/prisma";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { EmptyState } from "@/components/ui/empty-state";
import { Trophy } from "@/components/ui/icons";
import { GRAND_PRIX_TITLE, PRIZE_LEVELS } from "@/lib/prize-shared";
import { MAX_HERO_ENTRIES } from "@/lib/site-collections-shared";
import { HeroEditor, type HeroCandidate } from "@/components/site/hero-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "トップ掲載商品" };

// トップのヒーローに出す商品。特別枠に掲載している年度の設定を編集する
// （公開サイトはその年度の設定を読む。特別枠が無ければ、公開済みの最新年度）。
export default async function SiteHeroPage() {
  const settings = await prisma.siteAwardSettings.findMany({
    include: { award: { select: { id: true, year: true } } },
    orderBy: { award: { year: "desc" } },
  });
  const target = settings.find((s) => s.isFeatured) ?? settings.find((s) => s.winnersPublished) ?? null;

  const entries = await prisma.entry.findMany({
    where: { prizeLevel: { not: "" }, sitePublished: true },
    select: {
      id: true,
      productName: true,
      companyName: true,
      prefecture: true,
      prizeLevel: true,
      award: { select: { year: true } },
      titles: { where: { name: GRAND_PRIX_TITLE }, select: { id: true } },
      images: { where: { imageType: "main" }, take: 1, select: { id: true } },
      sitePhotoIds: true,
    },
  });

  const rank = (p: string) => {
    const i = (PRIZE_LEVELS as readonly string[]).indexOf(p);
    return i < 0 ? 99 : i;
  };
  const candidates: HeroCandidate[] = entries
    .map((e) => {
      const picked = Array.isArray(e.sitePhotoIds) ? e.sitePhotoIds.find((v) => Number.isInteger(v)) : null;
      return {
        id: e.id,
        productName: e.productName,
        companyName: e.companyName,
        prefecture: e.prefecture,
        prizeLevel: e.prizeLevel,
        grandPrix: e.titles.length > 0,
        year: e.award.year,
        imageId: (picked as number | undefined) ?? e.images[0]?.id ?? null,
      };
    })
    .sort((a, b) => b.year - a.year || Number(b.grandPrix) - Number(a.grandPrix) || rank(a.prizeLevel) - rank(b.prizeLevel) || a.id - b.id);

  if (!target) {
    return (
      <PageContainer>
        <PageHeader title="トップ掲載商品" />
        <EmptyState
          icon={Trophy}
          title="受賞商品を公開している年度がまだありません"
          description="受賞商品の公開で年度を公開にすると、その年度の受賞商品をトップに出せるようになります"
        />
      </PageContainer>
    );
  }

  // 自動のときに選ばれる並び（最新回のグランプリ→最高金賞→…）
  const autoIds = candidates
    .filter((c) => c.year === target.award.year && (c.grandPrix || c.prizeLevel === "最高金賞"))
    .slice(0, MAX_HERO_ENTRIES)
    .map((c) => c.id);
  const savedIds = (Array.isArray(target.heroEntryIds) ? target.heroEntryIds.filter((v): v is number => Number.isInteger(v)) : []).filter(
    (id) => candidates.some((c) => c.id === id),
  );

  return (
    <PageContainer>
      <PageHeader
        title="トップ掲載商品"
        description={`トップページの一番上に大きく出す商品（最大${MAX_HERO_ENTRIES}件）。特別枠に掲載している ${target.award.year}年度の設定です。`}
      />
      <HeroEditor
        awardId={target.awardId}
        year={target.award.year}
        mode={target.heroMode === "manual" ? "manual" : "auto"}
        savedIds={savedIds}
        autoIds={autoIds}
        candidates={candidates}
      />
    </PageContainer>
  );
}
