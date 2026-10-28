import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { relyingParty, storeChallenge } from "@/lib/passkey";

/**
 * パスキーでログインする第1段階（ログイン前なので /api/auth 配下＝認証なしで通る）。
 * 誰のパスキーかは聞かず、端末に保存されたパスキーから本人に選んでもらう。
 */
export async function POST(request: NextRequest) {
  const { rpID } = relyingParty(request);
  const options = await generateAuthenticationOptions({ rpID, userVerification: "required" });

  const res = NextResponse.json({ success: true, options });
  await storeChallenge(res, { challenge: options.challenge, purpose: "login" });
  return res;
}
