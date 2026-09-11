import { prisma } from "@/lib/prisma";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { FilterChip, FilterChipGroup } from "@/components/ui/filter-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { OverviewForm } from "@/components/site/overview-form";
import { utcToJstDateInputValue } from "@/lib/award-dates";
import { emptyOverview, normalizeOverview } from "@/lib/site-overview-shared";

export const dynamic = "force-dynamic";
export const metadata = { title: "開催概要" };

export default async function SiteOverviewPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const params = await searchParams;
  const awards = await prisma.award.findMany({
    orderBy: { year: "desc" },
    select: { id: true, year: true, isActive: true, entryStartDate: true, entryEndDate: true },
  });
  // 既定は受付中の年度、無ければ最新の年度
  const award =
    awards.find((a) => String(a.year) === params.year) ?? awards.find((a) => a.isActive) ?? awards[0];

  if (!award) {
    return (
      <PageContainer width="detail">
        <PageHeader title="開催概要" />
        <EmptyState title="年度がまだありません" description="年度管理で年度を作ると、ここで開催概要を書けます" />
      </PageContainer>
    );
  }

  const settings = await prisma.siteAwardSettings.findUnique({
    where: { awardId: award.id },
    select: { overview: true, announceDate: true, leafletUrl: true },
  });

  return (
    <PageContainer width="detail">
      <PageHeader
        title="開催概要"
        description="トップの「開催概要・募集要項」とエントリー費・タイムラインに出る内容。年度ごとに持ちます。"
      />
      <FilterChipGroup>
        {awards.map((a) => (
          <FilterChip key={a.id} href={`/site/overview?year=${a.year}`} active={a.id === award.id}>
            {a.year}年度{a.isActive ? "（受付中）" : ""}
          </FilterChip>
        ))}
      </FilterChipGroup>
      <OverviewForm
        key={award.id}
        awardId={award.id}
        year={award.year}
        initial={settings?.overview ? normalizeOverview(settings.overview) : emptyOverview()}
        initialAnnounceDate={utcToJstDateInputValue(settings?.announceDate)}
        initialLeafletUrl={settings?.leafletUrl ?? ""}
        entryStart={utcToJstDateInputValue(award.entryStartDate)}
        entryEnd={utcToJstDateInputValue(award.entryEndDate)}
      />
    </PageContainer>
  );
}
