/** サイト全体の設定（SiteConfig）の形と検証。画面とサーバーで共有する */

export type FooterLink = { label: string; url: string };

export type SiteConfigValues = {
  bannerOn: boolean;
  bannerTag: string;
  bannerText: string;
  bannerLinkText: string;
  bannerUrl: string;
  /** "YYYY-MM-DD"（JST）。未設定は "" */
  bannerFrom: string;
  bannerTo: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  footerLinks: FooterLink[];
  privacyBody: string;
  privacyUpdatedAt: string;
  mediaOutlets: string;
  /** ヒーローの実績数。第1回は受賞分しか取り込んでいないので、DB から数えず事務局の実数を入れる */
  statsEntries: number;
  statsPrefectures: number;
};

export const MAX_FOOTER_LINKS = 8;

export function emptySiteConfig(): SiteConfigValues {
  return {
    bannerOn: false, bannerTag: "INFO", bannerText: "", bannerLinkText: "", bannerUrl: "",
    bannerFrom: "", bannerTo: "", ogTitle: "", ogDescription: "", ogImageUrl: "",
    footerLinks: [], privacyBody: "", privacyUpdatedAt: "", mediaOutlets: "",
    statsEntries: 0, statsPrefectures: 0,
  };
}

/** フッターリンクを整える。リンク先は http(s) かサイト内のパス（/news など）だけ */
export function normalizeFooterLinks(raw: unknown): { links: FooterLink[]; error?: string } {
  if (!Array.isArray(raw)) return { links: [] };
  const links: FooterLink[] = [];
  for (const item of raw.slice(0, MAX_FOOTER_LINKS)) {
    const r = (item ?? {}) as Record<string, unknown>;
    const label = typeof r.label === "string" ? r.label.trim().slice(0, 60) : "";
    const url = typeof r.url === "string" ? r.url.trim().slice(0, 500) : "";
    if (!label && !url) continue;
    if (!label) return { links, error: "フッターリンクの表示名を入れてください" };
    if (!/^(https?:\/\/|\/|mailto:)/.test(url)) {
      return { links, error: `「${label}」のリンク先は http:// か / で始めてください` };
    }
    links.push({ label, url });
  }
  return { links };
}
