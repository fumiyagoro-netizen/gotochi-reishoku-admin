// 使い方ページ（src/app/help/page.tsx）の画面写真と、番号付き注釈の位置。
//
// 撮影スクリプトの出力をそのまま書き出したもので、手で座標を直さない。
// 画面のレイアウトが変わったら撮り直して、このファイルと public/help/*.webp を
// まとめて差し替える。
//
// 写真は 2026 年度（発表済み）の画面で、企業名・商品名・氏名・メールアドレス・
// 電話番号・請求金額は撮影時に架空の値へ置き換えてある（リポジトリが公開設定のため）。
// 撮影時に、画面の文字に本物の値が1つも残っていないことを機械的に確認している。
//
// x / y / w / h は画像の幅・高さに対する %。n は注釈の番号（説明文の並び順と同じ）。

export type HelpCallout = { n: number; x: number; y: number; w: number; h: number };
export type HelpShot = { src: string; width: number; height: number; callouts: HelpCallout[] };

export const HELP_SHOTS = {
  "sidebar": {
    src: "/help/sidebar.webp",
    width: 240,
    height: 820,
    callouts: [
      { n: 1, x: 5, y: 10.67, w: 89.58, h: 5.37 },
      { n: 2, x: 1.67, y: 18.6, w: 96.25, h: 21.95 },
      { n: 3, x: 1.67, y: 42.01, w: 96.25, h: 21.95 },
      { n: 4, x: 1.67, y: 65.43, w: 96.25, h: 21.95 },
      { n: 5, x: 3.33, y: 86.83, w: 92.92, h: 7.8 },
    ],
  },
  "dashboard": {
    src: "/help/dashboard.webp",
    width: 940,
    height: 720,
    callouts: [
      { n: 1, x: 2.98, y: 10.28, w: 94.04, h: 13.33 },
      { n: 2, x: 2.98, y: 25.83, w: 46.6, h: 73.33 },
    ],
  },
  "entries": {
    src: "/help/entries.webp",
    width: 940,
    height: 640,
    callouts: [
      { n: 1, x: 2.98, y: 11.88, w: 31.49, h: 6.88 },
      { n: 2, x: 34.47, y: 11.88, w: 19.57, h: 6.88 },
      { n: 3, x: 39.75, y: 3.13, w: 19.74, h: 6.88 },
      { n: 4, x: 59.5, y: 3.13, w: 19.27, h: 6.88 },
      { n: 5, x: 78.76, y: 3.13, w: 18.26, h: 6.88 },
      { n: 6, x: 4.79, y: 31.72, w: 2.55, h: 29.06 },
      { n: 7, x: 15.85, y: 30.23, w: 7.2, h: 7.5 },
    ],
  },
  "entry-detail": {
    src: "/help/entry-detail.webp",
    width: 940,
    height: 554,
    callouts: [
      { n: 1, x: 69.06, y: 8.3, w: 9.36, h: 7.94 },
      { n: 2, x: 78.42, y: 8.3, w: 9.45, h: 7.94 },
      { n: 3, x: 87.87, y: 8.3, w: 9.15, h: 7.94 },
      { n: 4, x: 13.72, y: 35.92, w: 15.74, h: 7.22 },
      { n: 5, x: 29.89, y: 35.92, w: 37.11, h: 7.22 },
      { n: 6, x: 13.72, y: 43.86, w: 34.83, h: 7.22 },
      { n: 7, x: 5.21, y: 70.4, w: 89.57, h: 25.63 },
    ],
  },
  "reviews": {
    src: "/help/reviews.webp",
    width: 940,
    height: 520,
    callouts: [
      { n: 1, x: 2.98, y: 18.46, w: 94.04, h: 12.31 },
      { n: 2, x: 2.98, y: 36.92, w: 94.04, h: 12.31 },
    ],
  },
  "awards": {
    src: "/help/awards.webp",
    width: 940,
    height: 520,
    callouts: [
      { n: 1, x: 2.98, y: 13.85, w: 94.04, h: 12.31 },
    ],
  },
  "email": {
    src: "/help/email.webp",
    width: 940,
    height: 1364,
    callouts: [
      { n: 1, x: 5.21, y: 10.63, w: 71.28, h: 2.93 },
      { n: 2, x: 5.21, y: 16.35, w: 47.28, h: 2.93 },
      { n: 3, x: 5.21, y: 25.44, w: 49.57, h: 2.93 },
      { n: 4, x: 5.21, y: 30.5, w: 71.28, h: 2.05 },
      { n: 5, x: 2.98, y: 40.1, w: 17.33, h: 2.93 },
      { n: 6, x: 63.66, y: 86.66, w: 13.26, h: 2.93 },
      { n: 7, x: 65.51, y: 95.31, w: 11.4, h: 3.23 },
    ],
  },
  "invoices": {
    src: "/help/invoices.webp",
    width: 940,
    height: 560,
    callouts: [
      { n: 1, x: 2.98, y: 14.29, w: 94.04, h: 26.07 },
      { n: 2, x: 70.43, y: 3.57, w: 14.47, h: 7.86 },
      { n: 3, x: 84.89, y: 3.57, w: 12.13, h: 7.86 },
      { n: 4, x: 72.21, y: 52.68, w: 24.71, h: 37.68 },
    ],
  },
  "upload": {
    src: "/help/upload.webp",
    width: 940,
    height: 520,
    callouts: [
      { n: 1, x: 3.19, y: 19.23, w: 17.87, h: 7.69 },
      { n: 2, x: 2.98, y: 29.62, w: 75.74, h: 22.69 },
    ],
  },
} satisfies Record<string, HelpShot>;

export type HelpShotName = keyof typeof HELP_SHOTS;
