import { prisma } from "@/lib/prisma";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { NewsEditor } from "@/components/site/news-editor";
import { utcToJstDateInputValue } from "@/lib/award-dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "お知らせ" };

export default async function SiteNewsPage() {
  const rows = await prisma.siteNews.findMany({
    orderBy: [{ isPinned: "desc" }, { publishedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
  });
  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    category: r.category,
    publishedAt: utcToJstDateInputValue(r.publishedAt),
    isPublished: r.isPublished,
    isPinned: r.isPinned,
  }));
  // トップに出るのは公開中の先頭3件（ピン留め → 公開日の新しい順。上の並びと同じ）
  const topIds = items.filter((n) => n.isPublished).slice(0, 3).map((n) => n.id);

  return (
    <PageContainer>
      <PageHeader
        title="お知らせ"
        count={items.length}
        description="公開サイトのお知らせ。トップには公開中の新しい3件（ピン留めが先頭）が出ます。"
      />
      <NewsEditor items={items} topIds={topIds} today={utcToJstDateInputValue(new Date())} />
    </PageContainer>
  );
}
