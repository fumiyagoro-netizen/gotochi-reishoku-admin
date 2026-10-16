import { notFound } from "next/navigation";
import { loadSitePublicData } from "@/lib/site-public";
import { siteBase } from "@/lib/site-links";
import { defaultOgImage, excerpt, pageMeta, SITE_NAME } from "@/lib/site-meta";
import { JsonLd, breadcrumbLd } from "../../_components/json-ld";
import { PUBLIC_SITE_ORIGIN } from "@/lib/site-host";
import { SiteFooter, SiteHeader } from "../../_components/site-chrome";
import { SafeImg } from "../../_components/safe-img";
import { Linkify } from "../../_components/linkify";
import { newsImages, newsPlainText, parseNewsBody } from "@/lib/news-body";
import { siteAssetSrc } from "@/lib/site-collections-shared";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { news } = await loadSitePublicData();
  const item = news.find((n) => n.id === Number(id));
  if (!item) return { title: "お知らせ" };
  // 本文に画像があれば、1枚目を共有したときの画像にする（無ければサイト共通の画像）
  const firstImage = newsImages(item.body)[0];
  return pageMeta({
    title: item.title,
    description: excerpt(newsPlainText(item.body) || item.title),
    path: `/news/${item.id}`,
    image: firstImage ? siteAssetSrc(firstImage.url, 1280) : await defaultOgImage(),
    type: "article",
  });
}

/** お知らせ本文 */
export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const base = await siteBase();
  const top = base || "/";
  const { id } = await params;
  const data = await loadSitePublicData();
  const { news } = data;
  const item = news.find((n) => n.id === Number(id));
  if (!item) notFound();
  const others = news.filter((n) => n.id !== item.id).slice(0, 3);
  const blocks = parseNewsBody(item.body);
  const firstImage = blocks.find((b) => b.type === "image");

  return (
    <>
      <SiteHeader top={top} />
      <div className="wrap article">
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "NewsArticle",
              headline: item.title,
              datePublished: item.date,
              ...(firstImage?.type === "image" ? { image: `${PUBLIC_SITE_ORIGIN}${siteAssetSrc(firstImage.url, 1280)}` } : {}),
              mainEntityOfPage: `${PUBLIC_SITE_ORIGIN}/news/${item.id}`,
              publisher: { "@type": "Organization", name: "一般社団法人未来の食卓" },
              isPartOf: { "@type": "WebSite", name: SITE_NAME, url: PUBLIC_SITE_ORIGIN },
            },
            breadcrumbLd(
              [
                { name: "トップ", path: "/" },
                { name: "お知らせ", path: "/news" },
                { name: item.title, path: `/news/${item.id}` },
              ],
              PUBLIC_SITE_ORIGIN,
            ),
          ]}
        />
        <a className="page-back" href={`${base}/news`}>← お知らせ一覧</a>
        <div style={{ marginTop: 24 }}>
          <div className="article-meta">
            <time dateTime={item.date}>{item.date.replace(/-/g, ".")}</time>
            <span className={`tag${item.category === "結果発表" ? " tag-gold" : ""}`}>{item.category}</span>
          </div>
          <h1>{item.title}</h1>
          {blocks.map((b, i) =>
            b.type === "text" ? (
              <div className="article-body" key={i}><Linkify text={b.text} /></div>
            ) : (
              <figure className="article-figure" key={i}>
                <SafeImg
                  src={siteAssetSrc(b.url, 1280)}
                  srcSet={`${siteAssetSrc(b.url, 640)} 640w, ${siteAssetSrc(b.url, 1280)} 1280w`}
                  sizes="(max-width: 1000px) 100vw, 904px"
                  alt={b.caption.trim() || item.title}
                  loading={i === 0 ? undefined : "lazy"}
                />
                {b.caption.trim() && <figcaption>{b.caption.trim()}</figcaption>}
              </figure>
            ),
          )}
        </div>
        {others.length > 0 && (
          <section className="article-more">
            <h2>ほかのお知らせ</h2>
            <ol className="news-list">
              {others.map((n) => (
                <li key={n.id}>
                  <a href={`${base}/news/${n.id}`}>
                    <div className="nm">
                      <time dateTime={n.date}>{n.date.replace(/-/g, ".")}</time>
                      <span className={`tag${n.category === "結果発表" ? " tag-gold" : ""}`}>{n.category}</span>
                    </div>
                    <span className="nt">{n.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </section>
        )}
        <div className="article-nav">
          <a className="page-back" href={`${base}/news`}>← お知らせ一覧</a>
        </div>
      </div>
      <SiteFooter data={data} top={top} base={base} />
    </>
  );
}
