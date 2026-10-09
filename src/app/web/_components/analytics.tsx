import Script from "next/script";
import { GOOGLE_TAG_IDS } from "@/lib/analytics";

/** Google タグ（アクセス計測）。公開サイトとエントリーページで読み込む。読み込みは1回で、送り先を並べて設定する */
export function GoogleTag() {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_IDS[0]}`} strategy="afterInteractive" />
      <Script id="google-tag" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
${GOOGLE_TAG_IDS.map((id) => `gtag('config', '${id}');`).join("\n")}`}
      </Script>
    </>
  );
}
