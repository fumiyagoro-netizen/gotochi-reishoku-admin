/**
 * 公開サイトの表示内容をためておく設定（Next.js のデータキャッシュ — unstable_cache）。
 *
 * 公開サイトは見られるたびにデータベース（Neon）を読んでいた。Neon は使われている時間で課金され、
 * 5分アクセスが無いと止まるので、表示に使うデータを最大10分ためて、そのあいだは読まないようにする
 * （src/lib/site-public.ts・src/app/sitemap.xml/route.ts）。
 *
 * 管理画面などで下のモデルに書き込んだら、そのたびに捨てて次の表示で読み直す（src/lib/prisma.ts の
 * 書き込みフック）。なので管理画面からの変更はすぐ反映され、10分待つのは「書き込み以外で変わるもの」
 * （特別枠の掲載期限が過ぎた等）と、アプリを通さずに DB を直接変えたときだけ。
 */
export const SITE_PUBLIC_TAG = "site-public";

/** ためておく時間（秒）。過ぎたあとの最初の表示で読み直す */
export const SITE_PUBLIC_REVALIDATE_SECONDS = 600;

/** 書き込んだら公開サイトのためを捨てるモデル（loadSitePublicData・サイトマップが読むもの） */
export const SITE_PUBLIC_MODELS: ReadonlySet<string> = new Set([
  "SiteConfig",
  "Award",
  "SiteAwardSettings",
  "SiteNews",
  "SiteVoice",
  "SitePartner",
  "SiteMedia",
  "SiteJudge",
  "Form",
  "Entry",
  "EntryImage",
  "EntryTitle",
]);
