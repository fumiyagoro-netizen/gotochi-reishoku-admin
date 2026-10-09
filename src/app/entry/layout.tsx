import type { Metadata } from "next";
import "../web/site.css";
import { PUBLIC_SITE_ORIGIN } from "@/lib/site-host";
import { defaultOgImage } from "@/lib/site-meta";
import { ModalProvider } from "../web/_components/modal-provider";
import { siteBase } from "@/lib/site-links";
import { GoogleTag } from "../web/_components/analytics";

export async function generateMetadata(): Promise<Metadata> {
  const image = await defaultOgImage();
  return {
  metadataBase: new URL(PUBLIC_SITE_ORIGIN),
  // 管理画面側のタイトルの付け方（「… | ご当地冷凍食品大賞」）が重ならないよう absolute にする
  title: { absolute: "エントリー｜日本全国！ご当地冷凍食品大賞" },
  description: "日本全国！ご当地冷凍食品大賞のエントリーフォームです。書類選考は無料。費用がかかるのは書類審査を通過した商品だけです。",
  alternates: { canonical: "/entry" },
  openGraph: {
    title: "エントリー｜日本全国！ご当地冷凍食品大賞",
    description: "日本全国！ご当地冷凍食品大賞のエントリーフォームです。書類選考は無料です。",
    url: "/entry",
    siteName: "日本全国！ご当地冷凍食品大賞",
    locale: "ja_JP",
    type: "website",
    images: image ? [image] : undefined,
  },
  };
}

/** エントリーフォームのページ。公開サイト（/web）と同じ見た目で出す */
export default async function EntryLayout({ children }: { children: React.ReactNode }) {
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
      <GoogleTag />
      <ModalProvider>
        <header className="nav is-scrolled">
          <div className="wrap nav-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a className="brand" href={top}><img src="/brand/logo_blue.png" alt="日本全国！ご当地冷凍食品大賞" /></a>
            <nav className="nav-links" aria-label="サイト内">
              <a href={top}>トップへ戻る</a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="foot">
          <div className="wrap foot-b">
            <small>© 一般社団法人未来の食卓</small>
            <small><a href={`${base}/privacy`}>プライバシーポリシー</a></small>
          </div>
        </footer>
      </ModalProvider>
    </div>
  );
}
