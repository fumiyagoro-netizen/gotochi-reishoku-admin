import { notFound } from "next/navigation";
import { loadSitePublicData } from "@/lib/site-public";
import { siteBase } from "@/lib/site-links";
import { defaultOgImage, excerpt, pageMeta, SITE_NAME } from "@/lib/site-meta";
import { JsonLd, breadcrumbLd } from "../../_components/json-ld";
import { PUBLIC_SITE_ORIGIN } from "@/lib/site-host";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { news } = await loadSitePublicData();
  const item = news.find((n) => n.id === Number(id));
  if (!item) return { title: "お知らせ" };
  return pageMeta({
    title: item.title,
    description: excerpt(item.body || item.title),
    path: `/news/${item.id}`,
    image: await defaultOgImage(),
    type: "article",
  });
}

/** お知らせ本文 */
export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const base = await siteBase();
  const top = base || "/";
  const { id } = await params;
  const { news } = await loadSitePublicData();
  const item = news.find((n) => n.id === Number(id));
  if (!item) notFound();

  return (
    <div className="wrap article">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: item.title,
            datePublished: item.date,
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
        {item.body && <div className="article-body">{item.body}</div>}
      </div>
      <div className="article-nav">
        <a className="page-back" href={`${base}/news`}>← お知らせ一覧</a>
      </div>
    </div>
  );
}
