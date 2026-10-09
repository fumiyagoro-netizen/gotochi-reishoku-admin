/**
 * 公開サイトと管理画面のドメインの振り分け（middleware からも使うので Edge で動く書き方だけ）。
 *
 * 同じアプリで2つのドメインを受ける:
 * - gotouchireisyoku.com            … 公開サイト。見えているパスを src/app/web のページへ書き換えて出す
 * - dashboard.gotouchireisyoku.com  … 管理画面（公開サイトの確認用プレビューは /web）
 */

export const PUBLIC_SITE_HOST = "gotouchireisyoku.com";
export const PUBLIC_SITE_ORIGIN = `https://${PUBLIC_SITE_HOST}`;
export const ADMIN_ORIGIN = "https://dashboard.gotouchireisyoku.com";

/** Host ヘッダーからポートを外して小文字にする */
export function hostOf(value: string | null | undefined): string {
  return (value || "").split(":")[0].trim().toLowerCase();
}

export function isPublicSiteHost(host: string): boolean {
  return host === PUBLIC_SITE_HOST || host === `www.${PUBLIC_SITE_HOST}`;
}

const SITE_PAGES = ["/winners", "/news", "/privacy"];

/** 公開サイトのURL（/、/winners/2026 など）を、実際のページ（/web、/web/winners/2026）に対応させる */
export function publicSiteRewrite(pathname: string): string | null {
  if (pathname === "/") return "/web";
  for (const p of SITE_PAGES) {
    if (pathname === p || pathname.startsWith(`${p}/`)) return `/web${pathname}`;
  }
  return null;
}

/** 管理画面のページ（公開ドメインで開かれたら管理用ドメインへ送る） */
const ADMIN_PAGES = [
  "/login", "/entries", "/reviews", "/awards", "/award-settings", "/contacts", "/email-logs", "/forms",
  "/invoices", "/logs", "/prospects", "/settings", "/site", "/ui-preview", "/upload", "/users",
];

export function isAdminPage(pathname: string): boolean {
  return ADMIN_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** 旧サイト（WordPress）のURLの行き先。該当しなければ null */
export function legacyRedirect(pathname: string): string | null {
  // 旧サイトのサイトマップ（Yoast の sitemap_index.xml / page-sitemap.xml など）→ 新しいサイトマップ
  if (pathname === "/sitemap_index.xml" || /^\/[a-z0-9_-]+-sitemap\d*\.xml$/i.test(pathname)) return "/sitemap.xml";
  // 募集要項リーフレットのPDF（チラシやQRコードから張られている）→ いまのリーフレット
  if (/^\/wp-content\/uploads\/.+\.pdf$/i.test(pathname)) return "/leaflet";
  if (pathname.startsWith("/wp-") || pathname === "/xmlrpc.php" || pathname === "/feed" || pathname.startsWith("/feed/")) {
    return "/";
  }
  return null;
}
