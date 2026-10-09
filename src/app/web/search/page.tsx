import { loadSitePublicData } from "@/lib/site-public";
import { editionRange } from "@/lib/site-public-shared";
import { siteBase } from "@/lib/site-links";
import { defaultOgImage, pageMeta } from "@/lib/site-meta";
import { SiteFooter, SiteHeader } from "../_components/site-chrome";
import { WinnersArchive } from "../_components/archive";
import { EntryCta } from "../_components/entry-cta";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    ...pageMeta({
      title: "受賞商品を探す",
      description: "日本全国！ご当地冷凍食品大賞の受賞商品を、商品名・会社名・都道府県・開催回・地域から探せます。",
      path: "/search",
      image: await defaultOgImage(),
    }),
    // 検索結果のページは検索エンジンに載せない（リンク先の商品ページはたどってもらう）
    robots: { index: false, follow: true },
  };
}

/** 受賞商品の検索ページ。ヘッダーの虫めがねから開く。?q= の検索語から始められる */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const base = await siteBase();
  const top = base || "/";
  const { q } = await searchParams;
  const initialQuery = (Array.isArray(q) ? q[0] : q ?? "").slice(0, 100);
  const data = await loadSitePublicData();
  const editions = [...new Set(data.winners.map((w) => w.year))]
    .sort((a, b) => b - a)
    .map((y) => ({ edition: y - 2024, range: editionRange(y) }));

  return (
    <>
      <SiteHeader top={top} />
      <div className="yp yp-page">
        <div className="wrap">
          <nav className="wp-crumb" aria-label="現在地">
            <a href={top}>トップ</a><span>›</span>
            <span>受賞商品を探す</span>
          </nav>
        </div>
        <div className="wrap yp-head">
          <p className="eyebrow">Search</p>
          <h1 className="h2">受賞商品を探す</h1>
          <p className="lead">
            商品名・会社名・都道府県のほか、「九州」などの地域名や「金賞」などの賞でも探せます。全{data.winners.length}品。
          </p>
        </div>
        <div className="wrap search-body">
          <WinnersArchive winners={data.winners} editions={editions} initialQuery={initialQuery} autoFocus syncUrl />
        </div>
      </div>
      <EntryCta data={data} top={top} />
      <SiteFooter data={data} top={top} base={base} />
    </>
  );
}
