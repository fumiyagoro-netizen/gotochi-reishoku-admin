/** サイト管理の一覧画面（お知らせ・審査員・受賞者の声・パートナー）で画面とサーバーが共有する定数 */

export const NEWS_CATEGORIES = ["開催情報", "結果発表", "メディア"] as const;
export const PARTNER_KINDS = ["主催", "後援", "協力", "協賛"] as const;

/** /api/site/upload の保存先の種類。画像は種類ごとの大きさに縮めて WebP にする。leaflet は PDF */
export const SITE_UPLOAD_KINDS = ["judge", "partner", "voice", "leaflet"] as const;
export type SiteUploadKind = (typeof SITE_UPLOAD_KINDS)[number];

export const MAX_VOICE_PHOTOS = 3;
/** Vercel の関数は本文 4.5MB までなので、アップロードは 4MB で止める */
export const SITE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

export type SiteCollectionKind = "news" | "judges" | "voices" | "partners";

/**
 * サイト用ファイル（審査員の写真・ロゴ・受賞者の声の写真・リーフレット）を画面に出すための URL。
 * Blob ストアが private 設定なので保存先の URL を直接 <img src> にできず、/api/site/asset を通して配信する。
 * 空なら ""（Thumb などには `|| undefined` で渡す）。
 */
export function siteAssetSrc(url: string | null | undefined): string {
  return url ? `/api/site/asset?u=${encodeURIComponent(url)}` : "";
}
