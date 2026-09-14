import { loadSitePublicData } from "@/lib/site-public";

export const dynamic = "force-dynamic";
export const metadata = { title: "お知らせ" };

/** お知らせ一覧 */
export default async function NewsListPage() {
  const { news } = await loadSitePublicData();
  return (
    <div className="wrap news-page">
      <div className="page-head">
        <a className="page-back" href="/web">← トップに戻る</a>
        <p className="eyebrow" style={{ marginTop: 18 }}>News</p>
        <h1 className="h2">お知らせ</h1>
      </div>
      {news.length === 0 ? (
        <p className="news-empty">お知らせはまだありません。</p>
      ) : (
        <ol className="news-list">
          {news.map((n) => (
            <li key={n.id}>
              <a href={`/web/news/${n.id}`}>
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
  );
}
