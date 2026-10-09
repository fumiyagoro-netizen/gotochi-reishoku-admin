import { NextRequest } from "next/server";
import { hostOf, isPublicSiteHost, PUBLIC_SITE_ORIGIN } from "@/lib/site-host";
import { previewEnabled } from "@/lib/preview-auth";

export const dynamic = "force-dynamic";

/**
 * 公開ドメインだけ検索エンジンに巡回させる。管理用ドメインは全部止める。
 * /api/ は止めるが、公開サイトに出している写真（/api/images・/api/site/asset）と共有用画像（/api/og）は許す。
 * 止めると画像検索に出ないうえ、X などは robots.txt に従うので共有したときに画像が出なくなる。
 * （長いほうの指定が優先されるので、Allow: /api/images/ が Disallow: /api/ に勝つ）
 */
export function GET(request: NextRequest) {
  const open = isPublicSiteHost(hostOf(request.headers.get("host"))) && !previewEnabled();
  const body = open
    ? [
        "User-agent: *",
        "Allow: /",
        "Allow: /api/images/",
        "Allow: /api/site/asset",
        "Allow: /api/og/",
        "Disallow: /api/",
        "",
        `Sitemap: ${PUBLIC_SITE_ORIGIN}/sitemap.xml`,
        "",
      ].join("\n")
    : "User-agent: *\nDisallow: /\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
