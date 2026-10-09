/**
 * 公開サイトのアクセス計測（Google アナリティクス）。旧サイトと同じ Google タグを使い、
 * 旧サイトからの記録が同じアナリティクスで続くようにしている。
 */
export const GOOGLE_TAG_ID = "GT-KDTJMJB9";

type Gtag = (command: "event", name: string, params?: Record<string, string | number>) => void;

/** 画面上の操作を Google アナリティクスにイベントとして送る（タグが読み込めていなければ何もしない） */
export function track(name: string, params?: Record<string, string | number>) {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag === "function") gtag("event", name, params);
}
