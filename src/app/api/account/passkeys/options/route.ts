import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { RP_NAME, parseTransports, relyingParty, storeChallenge } from "@/lib/passkey";

/** パスキー登録の第1段階。ログイン中の本人の分だけ作れる（ほかの人の分は作れない） */
export async function POST(request: NextRequest) {
  const current = await getUserFromRequest(request);
  if (!current) {
    return NextResponse.json({ success: false, message: "ログインしてください" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: current.userId },
    select: { id: true, email: true, name: true, passkeys: { select: { id: true, transports: true } } },
  });
  if (!user) {
    return NextResponse.json({ success: false, message: "ユーザーが見つかりません" }, { status: 404 });
  }

  const { rpID } = relyingParty(request);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: user.email,
    userDisplayName: user.name,
    // 同じ人の別の端末でも同じ ID にする（パスワードマネージャーが同じ人のパスキーとしてまとめられる）
    userID: new TextEncoder().encode(String(user.id)),
    attestationType: "none",
    // すでに登録済みの端末で二重に登録しない
    excludeCredentials: user.passkeys.map((p) => ({ id: p.id, transports: parseTransports(p.transports) })),
    // ログイン画面でメールアドレスを入れずに選べるよう、端末に保存するパスキーにする
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });

  const res = NextResponse.json({ success: true, options });
  await storeChallenge(res, { challenge: options.challenge, purpose: "register", userId: user.id });
  return res;
}
