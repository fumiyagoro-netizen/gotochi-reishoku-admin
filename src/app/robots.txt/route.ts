import { NextRequest } from "next/server";
import { hostOf, isPublicSiteHost, PUBLIC_SITE_ORIGIN } from "@/lib/site-host";
import { previewEnabled } from "@/lib/preview-auth";

export const dynamic = "force-dynamic";

/** 公開ドメインだけ検索エンジンに巡回させる。管理用ドメインは全部止める */
export function GET(request: NextRequest) {
  const open = isPublicSiteHost(hostOf(request.headers.get("host"))) && !previewEnabled();
  const body = open
    ? `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${PUBLIC_SITE_ORIGIN}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
