import { prisma } from "@/lib/prisma";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { PartnersEditor } from "@/components/site/partners-editor";
import { PARTNER_KINDS } from "@/lib/site-collections-shared";

export const dynamic = "force-dynamic";
export const metadata = { title: "パートナー・ロゴ" };

export default async function SitePartnersPage() {
  const rows = await prisma.sitePartner.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  // 種別の順（主催 → 後援 → 協力 → 協賛）に並べ、同じ種別の中は並び順どおり
  const kindRank = (k: string) => {
    const i = (PARTNER_KINDS as readonly string[]).indexOf(k);
    return i < 0 ? 99 : i;
  };
  const items = rows
    .map((r) => ({ id: r.id, kind: r.kind, name: r.name, url: r.url, logoUrl: r.logoUrl, isPublished: r.isPublished }))
    .sort((a, b) => kindRank(a.kind) - kindRank(b.kind));

  return (
    <PageContainer>
      <PageHeader
        title="パートナー・ロゴ"
        count={items.length}
        countUnit="件"
        description="主催・後援・協力・協賛のロゴとリンク。種別ごとに、並び順どおりにサイトに出ます。"
      />
      <PartnersEditor items={items} />
    </PageContainer>
  );
}
