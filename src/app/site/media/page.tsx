import { prisma } from "@/lib/prisma";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { FilterChip, FilterChipGroup } from "@/components/ui/filter-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { DigestForm, MediaOutletsForm } from "@/components/site/media-editor";
import { MediaListEditor } from "@/components/site/media-list-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "ムービー・メディア" };

export default async function SiteMediaPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const params = await searchParams;
  const [awards, rows, config] = await Promise.all([
    prisma.award.findMany({ orderBy: { year: "desc" }, select: { id: true, year: true, isActive: true, siteSettings: { select: { digestVideoId: true, digestCaption: true } } } }),
    prisma.siteMedia.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.siteConfig.findUnique({ where: { id: 1 }, select: { mediaOutlets: true } }),
  ]);
  // ダイジェストは年度ごと。既定は受付中の年度、無ければ最新
  const award = awards.find((a) => String(a.year) === params.year) ?? awards.find((a) => a.isActive) ?? awards[0];

  if (!award) {
    return (
      <PageContainer width="detail">
        <PageHeader title="ムービー・メディア" />
        <EmptyState title="年度がまだありません" description="年度管理で年度を作ると、ダイジェストムービーを設定できます" />
      </PageContainer>
    );
  }

  return (
    <PageContainer width="detail">
      <PageHeader
        title="ムービー・メディア"
        description="トップに出すダイジェストムービーと、テレビなどの掲載情報。"
      />
      <div className="space-y-6">
        <FilterChipGroup>
          {awards.map((a) => (
            <FilterChip key={a.id} href={`/site/media?year=${a.year}`} active={a.id === award.id}>
              {a.year}年度{a.isActive ? "（受付中）" : ""}
            </FilterChip>
          ))}
        </FilterChipGroup>

        <DigestForm
          key={award.id}
          awardId={award.id}
          year={award.year}
          videoId={award.siteSettings?.digestVideoId ?? ""}
          caption={award.siteSettings?.digestCaption ?? ""}
        />

        <MediaListEditor items={rows.map((r) => ({ id: r.id, name: r.name, outlet: r.outlet, youtubeId: r.youtubeId, isPublished: r.isPublished }))} />

        <MediaOutletsForm value={config?.mediaOutlets ?? ""} />
      </div>
    </PageContainer>
  );
}
