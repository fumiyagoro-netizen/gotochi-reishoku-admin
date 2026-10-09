import Script from "next/script";
import { GOOGLE_TAG_ID } from "@/lib/analytics";

/** Google タグ（アクセス計測）。公開サイトとエントリーページで読み込む */
export function GoogleTag() {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID}`} strategy="afterInteractive" />
      <Script id="google-tag" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GOOGLE_TAG_ID}');`}
      </Script>
    </>
  );
}
