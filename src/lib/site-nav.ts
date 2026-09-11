import {
  Globe,
  Trophy,
  LayoutGrid,
  MessageSquareQuote,
  CalendarRange,
  UserRoundCheck,
  Clapperboard,
  Newspaper,
  Handshake,
  Megaphone,
  type LucideIcon,
} from "@/components/ui/icons";

/**
 * サイト管理（/site）のメニュー。サイドバー（client）と /site のページ（server）の両方が読むので
 * "use client" を付けないこのファイルに置く。
 *
 * 10項目は docs/site-migration/README.md §4 の表を用途でまとめ直したもの。
 * ready=false はまだ画面が無い（段階的に作る）。サイドバーではリンクにせず「準備中」を出す。
 */
export type SiteNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** /site のページに出す一行説明 */
  description: string;
  ready: boolean;
};

export const SITE_NAV: { label: string; items: SiteNavItem[] }[] = [
  {
    label: "概要",
    items: [
      { href: "/site", label: "公開状況", icon: Globe, description: "公開サイトにいま何が出ているか、年度の切り替え", ready: true },
    ],
  },
  {
    label: "受賞商品",
    items: [
      { href: "/site/winners", label: "受賞商品の公開", icon: Trophy, description: "年度ごとの公開・特別枠、商品ごとの公開と表示写真", ready: true },
      { href: "/site/hero", label: "トップ掲載商品", icon: LayoutGrid, description: "トップページに大きく出す商品と順番", ready: false },
      { href: "/site/voices", label: "受賞者の声", icon: MessageSquareQuote, description: "受賞商品に紐づけたコメントと写真", ready: false },
    ],
  },
  {
    label: "年度の内容",
    items: [
      { href: "/site/overview", label: "開催概要", icon: CalendarRange, description: "募集期間・エントリー費・発表日・タイムライン", ready: false },
      { href: "/site/judges", label: "審査員", icon: UserRoundCheck, description: "年度ごとの審査員の氏名・肩書き・写真・並び順", ready: false },
      { href: "/site/media", label: "ムービー・メディア", icon: Clapperboard, description: "ダイジェストムービーと掲載メディア", ready: false },
    ],
  },
  {
    label: "サイト全体",
    items: [
      { href: "/site/news", label: "お知らせ", icon: Newspaper, description: "お知らせの作成・公開日・ピン留め", ready: false },
      { href: "/site/partners", label: "パートナー・ロゴ", icon: Handshake, description: "主催・後援・協力・協賛のロゴと並び順", ready: false },
      { href: "/site/banner", label: "バナー・サイト設定", icon: Megaphone, description: "上部バナー・OGP・フッター・プライバシーポリシー", ready: false },
    ],
  },
];

/** /site とその配下。/sitemap のような別パスを巻き込まないよう区切りで判定する */
export function isSitePath(pathname: string): boolean {
  return pathname === "/site" || pathname.startsWith("/site/");
}

/** メニュー項目がアクティブか。/site（公開状況）は完全一致、それ以外は配下も含める */
export function isSiteNavActive(pathname: string, href: string): boolean {
  return href === "/site" ? pathname === "/site" : pathname === href || pathname.startsWith(href + "/");
}
