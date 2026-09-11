import { prisma } from "@/lib/prisma";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { FilterChip, FilterChipGroup } from "@/components/ui/filter-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { JudgesEditor } from "@/components/site/judges-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "審査員" };

export default async function SiteJudgesPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const params = await searchParams;
  const awards = await prisma.award.findMany({
    orderBy: { year: "desc" },
    select: { id: true, year: true, _count: { select: { siteJudges: true } } },
  });
  // 既定は最新の年度（募集中の年度の審査員を出すことが多いため）
  const award = awards.find((a) => String(a.year) === params.year) ?? awards[0];

  if (!award) {
    return (
      <PageContainer>
        <PageHeader title="審査員" />
        <EmptyState title="年度がまだありません" description="年度管理で年度を作ると、ここで審査員を登録できます" />
      </PageContainer>
    );
  }

  const rows = await prisma.siteJudge.findMany({ where: { awardId: award.id }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  const items = rows.map((r) => ({ id: r.id, name: r.name, title: r.title, role: r.role, photoUrl: r.photoUrl, isPublished: r.isPublished }));

  return (
    <PageContainer>
      <PageHeader title="審査員" count={items.length} countUnit="名" description="年度ごとに登録します。並び順どおりにサイトに出ます。" />
      <FilterChipGroup>
        {awards.map((a) => (
          <FilterChip key={a.id} href={`/site/judges?year=${a.year}`} active={a.id === award.id} count={a._count.siteJudges}>
            {a.year}年度
          </FilterChip>
        ))}
      </FilterChipGroup>
      <JudgesEditor key={award.id} awardId={award.id} items={items} />
    </PageContainer>
  );
}
