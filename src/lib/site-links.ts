import { headers } from "next/headers";
import { hostOf, isPublicSiteHost } from "./site-host";

/**
 * 公開サイトの中のリンクの頭につける文字列（サーバー専用）。
 * 公開ドメインでは "" （/news）、管理用ドメインのプレビューでは "/web"（/web/news）。
 */
export async function siteBase(): Promise<string> {
  const h = await headers();
  return isPublicSiteHost(hostOf(h.get("x-forwarded-host") || h.get("host"))) ? "" : "/web";
}

/** 公開ドメインで見られているか（検索エンジンに載せるかの判断に使う） */
export async function onPublicSiteHost(): Promise<boolean> {
  return (await siteBase()) === "";
}
