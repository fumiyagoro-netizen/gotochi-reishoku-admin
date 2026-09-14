import { notFound } from "next/navigation";
import { loadSitePublicData } from "@/lib/site-public";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { news } = await loadSitePublicData();
  const item = news.find((n) => n.id === Number(id));
  return { title: item?.title ?? "お知らせ" };
}

/** お知らせ本文 */
export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { news } = await loadSitePublicData();
  const item = news.find((n) => n.id === Number(id));
  if (!item) notFound();

  return (
    <div className="wrap article">
      <a className="page-back" href="/web/news">← お知らせ一覧</a>
      <div style={{ marginTop: 24 }}>
        <div className="article-meta">
          <time dateTime={item.date}>{item.date.replace(/-/g, ".")}</time>
          <span className={`tag${item.category === "結果発表" ? " tag-gold" : ""}`}>{item.category}</span>
        </div>
        <h1>{item.title}</h1>
        {item.body && <div className="article-body">{item.body}</div>}
      </div>
      <div className="article-nav">
        <a className="page-back" href="/web/news">← お知らせ一覧</a>
      </div>
    </div>
  );
}
