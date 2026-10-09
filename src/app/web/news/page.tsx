import { loadSitePublicData } from "@/lib/site-public";
import { siteBase } from "@/lib/site-links";
import { defaultOgImage, pageMeta } from "@/lib/site-meta";
import { SiteFooter, SiteHeader } from "../_components/site-chrome";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return pageMeta({
    title: "お知らせ",
    description: "日本全国！ご当地冷凍食品大賞のお知らせ一覧です。開催情報・結果発表・メディア掲載などをお知らせします。",
    path: "/news",
    image: await defaultOgImage(),
  });
}

/** お知らせ一覧 */
export default async function NewsListPage() {
  const base = await siteBase();
  const top = base || "/";
  const data = await loadSitePublicData();
  const { news } = data;
  return (
    <>
      <SiteHeader top={top} />
      <div className="wrap news-page">
        <div className="page-head">
          <a className="page-back" href={top}>← トップに戻る</a>
          <p className="eyebrow" style={{ marginTop: 18 }}>News</p>
          <h1 className="h2">お知らせ</h1>
        </div>
        {news.length === 0 ? (
          <p className="news-empty">お知らせはまだありません。</p>
        ) : (
          <ol className="news-list">
            {news.map((n) => (
              <li key={n.id}>
                <a href={`${base}/news/${n.id}`}>
                  <div className="nm">
                    <time dateTime={n.date}>{n.date.replace(/-/g, ".")}</time>
                    <span className={`tag${n.category === "結果発表" ? " tag-gold" : ""}`}>{n.category}</span>
                  </div>
                  <span className="nt">{n.title}</span>
                  <span className="chev">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        )}
      </div>
      <SiteFooter data={data} top={top} base={base} />
    </>
  );
}
