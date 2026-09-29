/**
 * 公開前の確認用アクセス（Basic認証）。Edge でも動くように Web Crypto だけを使う。
 *
 * 目的: 公開サイト（/web）を、管理画面にログインしていない社外の方（スポンサー等）に
 * ID・パスワードだけで見てもらう。管理画面（/entries など）はこれまでどおりログインが必要で、
 * この仕組みからは一切入れない。
 *
 * PREVIEW_USER / PREVIEW_PASSWORD が未設定なら何も起きず、これまでどおりログインが要る。
 * 公開に踏み切るときは、この2つの環境変数を消し、/web を PUBLIC_PATHS に移すだけでよい。
 */

export const PREVIEW_COOKIE = "site_preview";
export const PREVIEW_MAX_AGE = 60 * 60 * 12; // 12時間で切れる（毎日入れ直す想定）
export const PREVIEW_REALM = "gotouchi site preview";

/** Basic認証をかけるパス。/web の配下と、そこが使うサイト用ファイルの配信 */
export const PREVIEW_PATHS = ["/web", "/api/site/asset"];

export function previewEnabled(): boolean {
  return !!(process.env.PREVIEW_USER && process.env.PREVIEW_PASSWORD);
}

function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(data: string): Promise<string> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`preview.${data}`));
  return b64urlEncode(new Uint8Array(sig));
}

/** 合言葉が合っているか（時間差で漏れないように1文字ずつ全部見る） */
function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Authorization: Basic ... を確かめる */
export function checkBasicAuth(header: string | null): boolean {
  if (!header || !header.startsWith("Basic ")) return false;
  const user = process.env.PREVIEW_USER || "";
  const password = process.env.PREVIEW_PASSWORD || "";
  if (!user || !password) return false;
  try {
    const raw = header.slice(6).trim();
    const decoded = typeof atob === "function" ? atob(raw) : Buffer.from(raw, "base64").toString("utf-8");
    const sep = decoded.indexOf(":");
    if (sep < 0) return false;
    return sameString(decoded.slice(0, sep), user) && sameString(decoded.slice(sep + 1), password);
  } catch {
    return false;
  }
}

/** 合言葉が合った人に渡す通行証（見るだけ。管理画面には使えない） */
export async function createPreviewToken(): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + PREVIEW_MAX_AGE;
  return `${exp}.${await sign(String(exp))}`;
}

export async function verifyPreviewToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expStr, signature] = token.split(".");
  if (!expStr || !signature) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  try {
    return sameString(await sign(expStr), signature);
  } catch {
    return false;
  }
}
