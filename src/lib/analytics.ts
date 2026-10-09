/**
 * 公開サイトのアクセス計測（Google アナリティクス）。
 * - GT-KDTJMJB9 … 旧サイトから引き継いだ Google タグ（送り先 GA4 は G-96JZPCCFB5）。持ち主が別のアカウントで
 *   こちらからは開けないが、記録が途切れないよう送り続ける
 * - 2つ目以降 … 事務局のアカウントで作った GA4。サイト管理の「アクセス状況」はこちらを読む（src/lib/ga.ts）
 * 画面の操作のイベント（track）は、ここに並べたすべてに送られる。
 */
export const GOOGLE_TAG_IDS = ["GT-KDTJMJB9", "G-J30TPS5JLC"];

type Gtag = (command: "event", name: string, params?: Record<string, string | number>) => void;

/** 画面上の操作を Google アナリティクスにイベントとして送る（タグが読み込めていなければ何もしない） */
export function track(name: string, params?: Record<string, string | number>) {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag === "function") gtag("event", name, params);
}
