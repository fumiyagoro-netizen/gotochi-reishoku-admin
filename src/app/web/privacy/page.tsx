import { loadSitePublicData } from "@/lib/site-public";

export const dynamic = "force-dynamic";
export const metadata = { title: "プライバシーポリシー" };

/** プライバシーポリシー（管理画面のバナー・サイト設定で編集する） */
export default async function PrivacyPage() {
  const { config } = await loadSitePublicData();
  const updated = config.privacyUpdatedAt
    ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" }).format(config.privacyUpdatedAt)
    : "";

  return (
    <div className="wrap article">
      <a className="page-back" href="/web">← トップに戻る</a>
      <div style={{ marginTop: 24 }}>
        <h1>プライバシーポリシー</h1>
        {updated && <p className="article-meta"><time>{updated} 改定</time></p>}
        {config.privacyBody ? (
          <div className="article-body">{config.privacyBody}</div>
        ) : (
          <p className="news-empty">準備中です。</p>
        )}
      </div>
    </div>
  );
}
