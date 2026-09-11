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
