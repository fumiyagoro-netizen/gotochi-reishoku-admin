/**
 * 障害の通知メール（サーバー専用）。
 *
 * 宛先は環境変数 ALERT_EMAILS（カンマ区切り）。未設定ならログに出すだけで送らない。
 * 同じ内容の通知は30分に1回まで（エラーが続いても受信箱が埋まらないように）。
 * 送信履歴（EmailLog）には残さない — 応募者・見込み客へのメールの記録と混ざらないように。
 * src/instrumentation.ts からも読み込むので、Resend の SDK は使わず API を直接呼ぶ（SDK は任意の依存を探して警告が出る）。
 */

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@gotouchireisyoku.com";
const THROTTLE_MS = 30 * 60 * 1000;
const lastSent = new Map<string, number>();

function recipients(): string[] {
  return (process.env.ALERT_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** 通知を送る。key が同じものは30分に1回まで。送ったら true */
export async function sendAlert(subject: string, lines: string[], key = subject): Promise<boolean> {
  console.error(`[alert] ${subject}\n${lines.join("\n")}`);
  const to = recipients();
  if (!to.length || !process.env.RESEND_API_KEY) return false;
  const now = Date.now();
  if (now - (lastSent.get(key) ?? 0) < THROTTLE_MS) return false;
  lastSent.set(key, now);
  const time = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "medium" }).format(now);
  const body = [...lines, "", `発生時刻（日本時間）: ${time}`, "同じ内容の通知は30分に1回までにしています。"];
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `ご当地冷凍食品大賞 システム通知 <${FROM_EMAIL}>`,
        to,
        subject: `【要確認】${subject}`,
        text: body.join("\n"),
        html: `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(body.join("\n"))}</pre>`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return true;
  } catch (e) {
    console.error("[alert] failed to send:", e);
    return false;
  }
}

/** サーバーで処理しきれなかったエラー（src/instrumentation.ts の onRequestError から呼ぶ） */
export async function reportRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
): Promise<void> {
  const e = err as { message?: string; digest?: string; name?: string };
  // ページの「見つかりません」や転送は Next.js の仕組みで、障害ではない
  if (typeof e?.digest === "string" && /^NEXT_(NOT_FOUND|REDIRECT|HTTP_ERROR_FALLBACK)/.test(e.digest)) return;
  const message = (e?.message ?? String(err)).slice(0, 500);
  await sendAlert(
    "サイトでエラーが発生しました",
    [
      "サイトまたは管理画面で、処理しきれなかったエラーが起きました。",
      "",
      `場所: ${request.method} ${request.path.split("?")[0]}`,
      `ルート: ${context.routePath}（${context.routeType}）`,
      `内容: ${e?.name ? `${e.name}: ` : ""}${message}`,
      e?.digest ? `識別番号: ${e.digest}（Vercel のログで検索できます）` : "",
    ].filter((l) => l !== ""),
    `error:${context.routePath}:${message.slice(0, 120)}`,
  );
}
