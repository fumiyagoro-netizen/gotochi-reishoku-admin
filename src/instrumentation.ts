import type { Instrumentation } from "next";

export async function register() {
  // 画像処理（sharp）で SVG を読み込まない（src/lib/sharp.ts を参照）。Next.js 自身の画像処理にも効くよう起動時に設定する
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/sharp");
  }
}

/**
 * サーバー側で処理しきれなかったエラーを、障害の通知メールで知らせる（src/lib/alert.ts）。
 * ページの描画・API・middleware のどこで起きたものも、ここに集まる。
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportRequestError } = await import("./lib/alert");
  await reportRequestError(err, request, context);
};
