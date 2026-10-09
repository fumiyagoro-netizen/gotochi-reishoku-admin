import { prisma } from "@/lib/prisma";
import { PUBLIC_SITE_ORIGIN } from "@/lib/site-host";

export const dynamic = "force-dynamic";

/** 公開サイトのページ一覧（検索エンジン向け）。受賞商品を公開している年度とお知らせを含める */
export async function GET() {
  const [years, news, winners] = await Promise.all([
    prisma.siteAwardSettings.findMany({ where: { winnersPublished: true }, select: { award: { select: { year: true } } } }),
    prisma.siteNews.findMany({ where: { isPublished: true }, select: { id: true, updatedAt: true } }),
    // 受賞商品ごとのページ（公開サイトに出している商品だけ）
    prisma.entry.findMany({
      where: { prizeLevel: { not: "" }, sitePublished: true, award: { siteSettings: { winnersPublished: true } } },
      select: { id: true, award: { select: { year: true } } },
      orderBy: { id: "asc" },
    }),
  ]);
  const urls: { loc: string; lastmod?: string }[] = [
    { loc: "/" },
    { loc: "/entry" },
    { loc: "/news" },
    { loc: "/privacy" },
    ...years.map((y) => ({ loc: `/winners/${y.award.year}` })),
    ...news.map((n) => ({ loc: `/news/${n.id}`, lastmod: n.updatedAt.toISOString().slice(0, 10) })),
    ...winners.map((w) => ({ loc: `/winners/${w.award.year}/${w.id}` })),
  ];
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${PUBLIC_SITE_ORIGIN}${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`).join("\n") +
    `\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
