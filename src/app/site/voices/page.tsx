import { prisma } from "@/lib/prisma";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { VoicesEditor } from "@/components/site/voices-editor";
import { GRAND_PRIX_TITLE, PRIZE_LEVELS } from "@/lib/prize-shared";

export const dynamic = "force-dynamic";
export const metadata = { title: "受賞者の声" };

const prizeRank = (p: string) => {
  const i = (PRIZE_LEVELS as readonly string[]).indexOf(p);
  return i < 0 ? 99 : i;
};

export default async function SiteVoicesPage() {
  const [rows, prized] = await Promise.all([
    prisma.siteVoice.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: {
        entry: {
          select: {
            productName: true,
            companyName: true,
            prizeLevel: true,
            award: { select: { year: true } },
            titles: { where: { name: GRAND_PRIX_TITLE }, select: { id: true } },
          },
        },
      },
    }),
    prisma.entry.findMany({
      where: { prizeLevel: { not: "" } },
      select: {
        id: true,
        productName: true,
        companyName: true,
        prizeLevel: true,
        award: { select: { year: true } },
        titles: { where: { name: GRAND_PRIX_TITLE }, select: { id: true } },
      },
    }),
  ]);

  const tag = (e: { prizeLevel: string; award: { year: number }; titles: { id: number }[] }) =>
    `${e.award.year}年度 ${e.titles.length > 0 ? "グランプリ・" : ""}${e.prizeLevel}`;

  const items = rows.map((r) => ({
    id: r.id,
    entryId: r.entryId,
    quote: r.quote,
    photoUrls: Array.isArray(r.photoUrls) ? r.photoUrls.filter((u): u is string => typeof u === "string") : [],
    isPublished: r.isPublished,
    entryTag: tag(r.entry),
    productName: r.entry.productName,
    companyName: r.entry.companyName,
  }));

  const entryOptions = prized
    .sort((a, b) => b.award.year - a.award.year || b.titles.length - a.titles.length || prizeRank(a.prizeLevel) - prizeRank(b.prizeLevel) || a.id - b.id)
    .map((e) => ({ value: String(e.id), label: `${tag(e)}｜${e.productName}（${e.companyName}）` }));

  return (
    <PageContainer>
      <PageHeader
        title="受賞者の声"
        count={items.length}
        description="受賞商品に紐づけて、受賞者のコメントと写真（3枚まで）を載せます。並び順どおりに横スクロールで表示されます。"
      />
      <VoicesEditor items={items} entryOptions={entryOptions} />
    </PageContainer>
  );
}
