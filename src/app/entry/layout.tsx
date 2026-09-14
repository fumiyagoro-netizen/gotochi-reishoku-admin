import type { Metadata } from "next";
import "../web/site.css";
import { ModalProvider } from "../web/_components/modal-provider";

export const metadata: Metadata = {
  title: "エントリー｜日本全国！ご当地冷凍食品大賞",
  description: "日本全国！ご当地冷凍食品大賞のエントリーフォームです。書類選考は無料です。",
};

/** エントリーフォームのページ。公開サイト（/web）と同じ見た目で出す */
export default function EntryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-root">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@500;700;900&family=Noto+Sans+JP:wght@400;500;700&family=Manrope:wght@500;700;800&display=swap"
      />
      <ModalProvider>
        <header className="nav is-scrolled">
          <div className="wrap nav-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a className="brand" href="/web"><img src="/site/logo_blue.png" alt="日本全国！ご当地冷凍食品大賞" /></a>
            <nav className="nav-links" aria-label="サイト内">
              <a href="/web">トップへ戻る</a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="foot">
          <div className="wrap foot-b">
            <small>© 一般社団法人未来の食卓</small>
            <small><a href="/web/privacy">プライバシーポリシー</a></small>
          </div>
        </footer>
      </ModalProvider>
    </div>
  );
}
