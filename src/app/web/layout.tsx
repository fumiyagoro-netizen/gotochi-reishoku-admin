import type { Metadata } from "next";
import "./site.css";
import { ModalProvider } from "./_components/modal-provider";
import { SiteMotion } from "./_components/motion";
import { previewEnabled } from "@/lib/preview-auth";
import { onPublicSiteHost } from "@/lib/site-links";
import { PUBLIC_SITE_ORIGIN } from "@/lib/site-host";

export async function generateMetadata(): Promise<Metadata> {
  // 検索結果に出すのは公開ドメイン（gotouchireisyoku.com）だけ。
  // 管理用ドメインのプレビューと、公開前の確認中（PREVIEW_USER がある間）は出さない。
  const indexable = !previewEnabled() && (await onPublicSiteHost());
  return {
    metadataBase: new URL(PUBLIC_SITE_ORIGIN),
    title: { default: "日本全国！ご当地冷凍食品大賞", template: "%s｜日本全国！ご当地冷凍食品大賞" },
    description: "全国から集まったご当地冷凍食品を、審査員が一品一品試食して評価するアワードです。",
    robots: indexable ? undefined : { index: false, follow: false },
  };
}

/**
 * 公開サイト（gotouchireisyoku.com）の見た目。
 * 公開ドメイン（gotouchireisyoku.com）では middleware が / や /news をこのページに書き換えて出す。
 * 管理用ドメインの /web は公開前の確認用（Basic認証）で、公開後は公開ドメインへ転送する。
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
