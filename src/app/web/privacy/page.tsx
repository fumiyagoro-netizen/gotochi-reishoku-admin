import { loadSitePublicData } from "@/lib/site-public";
import { siteBase } from "@/lib/site-links";
import { defaultOgImage, pageMeta } from "@/lib/site-meta";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return pageMeta({
    title: "プライバシーポリシー",
    description: "日本全国！ご当地冷凍食品大賞（主催：一般社団法人未来の食卓）における個人情報の取り扱いについて定めています。",
    path: "/privacy",
    image: await defaultOgImage(),
  });
}

/** プライバシーポリシー（管理画面のバナー・サイト設定で編集する） */
export default async function PrivacyPage() {
  const base = await siteBase();
  const top = base || "/";
  const { config } = await loadSitePublicData();
  const updated = config.privacyUpdatedAt
    ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" }).format(config.privacyUpdatedAt)
    : "";

  return (
    <div className="wrap article">
      <a className="page-back" href={top}>← トップに戻る</a>
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
