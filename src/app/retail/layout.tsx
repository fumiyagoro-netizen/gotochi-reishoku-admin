import type { Metadata } from "next";
import "../web/site.css";
import { siteBase } from "@/lib/site-links";

// 流通企画の申請ページ（担当者ごとの専用URL）。検索に載せず、ページ内のリンクから URL（token）が
// 他のサイトに渡らないよう referrer を送らない。アクセス解析のタグも入れない（URL が送られるため）
export const metadata: Metadata = {
  title: { absolute: "流通企画への参加のご回答｜日本全国！ご当地冷凍食品大賞" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function RetailLayout({ children }: { children: React.ReactNode }) {
  const base = await siteBase();
  const top = base || "/";
  return (
    <div className="site-root">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@500;700;900&family=Noto+Sans+JP:wght@400;500;700&family=Manrope:wght@500;700;800&display=swap"
      />
      <header className="nav is-scrolled">
        <div className="wrap nav-in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <a className="brand" href={top}><img src="/brand/logo_blue.png" alt="日本全国！ご当地冷凍食品大賞" /></a>
        </div>
      </header>
      <main>{children}</main>
      <footer className="foot">
        <div className="wrap foot-b">
          <small>© 一般社団法人未来の食卓</small>
          <small><a href={`${base}/privacy`}>プライバシーポリシー</a></small>
        </div>
      </footer>
    </div>
  );
}
