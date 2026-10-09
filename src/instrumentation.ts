import type { Instrumentation } from "next";

export function register() {}

/**
 * サーバー側で処理しきれなかったエラーを、障害の通知メールで知らせる（src/lib/alert.ts）。
 * ページの描画・API・middleware のどこで起きたものも、ここに集まる。
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportRequestError } = await import("./lib/alert");
  await reportRequestError(err, request, context);
};
