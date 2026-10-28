/**
 * パスキー（WebAuthn）の共通処理。サーバー専用。
 *
 * 流れ:
 *   登録   … ログイン済みの人が /api/account/passkeys/options → ブラウザで作成 → /api/account/passkeys で保存
 *   ログイン … /api/auth/passkey/options → ブラウザで署名 → /api/auth/passkey で照合してセッション発行
 * どちらも、サーバーが出したチャレンジを署名つき cookie に5分だけ預け、返ってきた応答と突き合わせる
 * （DB にチャレンジ用の表を持たないため）。cookie は一度使ったら消す。
 *
 * パスワードは残してあり、パスキーはログイン方法の追加。
 */
import type { NextRequest, NextResponse } from "next/server";
import { createSignedValue, verifySignedValue } from "./auth-core";
import { ADMIN_ORIGIN } from "./site-host";

export const RP_NAME = "ご当地冷凍食品大賞 管理画面";

const CHALLENGE_COOKIE = "passkey_challenge";
const CHALLENGE_MAX_AGE = 60 * 5;

type ChallengePurpose = "register" | "login";
type StoredChallenge = { challenge: string; purpose: ChallengePurpose; userId?: number };

/**
 * パスキーはドメインに結びつく。本番は管理用ドメインに固定し（プレビューURLなど他のドメインでは
 * 登録もログインもできない）、開発中は開いているURL（localhost）をそのまま使う。
 */
export function relyingParty(request: NextRequest): { rpID: string; origin: string } {
  if (process.env.NODE_ENV === "production") {
    return { rpID: new URL(ADMIN_ORIGIN).hostname, origin: ADMIN_ORIGIN };
  }
  return { rpID: request.nextUrl.hostname, origin: request.nextUrl.origin };
}

export async function storeChallenge(res: NextResponse, value: StoredChallenge): Promise<void> {
  res.cookies.set(CHALLENGE_COOKIE, await createSignedValue(value, CHALLENGE_MAX_AGE), {
    path: "/api",
    httpOnly: true,
    sameSite: "strict",
    maxAge: CHALLENGE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

/** 預けたチャレンジを取り出す。用途（登録／ログイン）が違うもの・期限切れは null */
export async function readChallenge(
  request: NextRequest,
  purpose: ChallengePurpose,
): Promise<StoredChallenge | null> {
  const raw = request.cookies.get(CHALLENGE_COOKIE)?.value;
  if (!raw) return null;
  const value = await verifySignedValue<StoredChallenge>(raw);
  return value && value.purpose === purpose ? value : null;
}

export function clearChallenge(res: NextResponse): void {
  res.cookies.set(CHALLENGE_COOKIE, "", { path: "/api", maxAge: 0 });
}

export function parseTransports(value: string): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

// よく使われるパスキーの保存先（AAGUID → 名前）。一覧で「どこに保存したパスキーか」を
// 見分けるためだけの表示用。載っていないものは端末名だけで出す。
const PROVIDERS: Record<string, string> = {
  "fbfc3007-154e-4ecc-8c0b-6e020557d7bd": "iCloud キーチェーン",
  "dd4ec289-e01d-41c9-bb89-70fa845d4bf2": "iCloud キーチェーン",
  "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4": "Google パスワードマネージャー",
  "08987058-cadc-4b81-b6e1-30de50dcbe96": "Windows Hello",
  "9ddd1817-af5a-4672-a2b9-3e3dd95000a9": "Windows Hello",
  "6028b017-b1d4-4c02-b4b3-afcdafc96bb2": "Windows Hello",
  "bada5566-a7aa-401f-bd96-45619a55120d": "1Password",
  "d548826e-79b4-db40-a3d8-11116f7e8349": "Bitwarden",
};

/** 一覧に出す名前（例「Mac・iCloud キーチェーン」）。登録したときの端末と保存先から作る */
export function passkeyName(userAgent: string | null, aaguid: string): string {
  const ua = userAgent ?? "";
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh|Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : "この端末";
  const provider = PROVIDERS[aaguid];
  return provider ? `${device}・${provider}` : device;
}
