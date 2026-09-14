import type { Metadata } from "next";
import "./site.css";
import { ModalProvider } from "./_components/modal-provider";
import { SiteMotion } from "./_components/motion";

export const metadata: Metadata = {
  title: { default: "日本全国！ご当地冷凍食品大賞", template: "%s｜日本全国！ご当地冷凍食品大賞" },
  description: "全国から集まったご当地冷凍食品を、審査員が一品一品試食して評価するアワードです。",
};

/**
 * 公開サイト（gotouchireisyoku.com）の見た目。
 * 今は管理画面と同じアプリの /web に置いていてログインが要る（公開前の確認用）。
 * 公開するときは src/lib/public-paths.ts の PUBLIC_PATHS に "/web" と "/api/site/asset" を足す。
 */
export default function WebLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-root">
      {/* 本文と同じ書体をプロトタイプから引き継ぐ。Google Fonts は表示をブロックしない */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@500;700;900&family=Noto+Sans+JP:wght@400;500;700&family=Manrope:wght@500;700;800&display=swap"
      />
      <ModalProvider>
        <SiteMotion />
        {children}
      </ModalProvider>
    </div>
  );
}
