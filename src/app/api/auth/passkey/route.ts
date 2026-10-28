import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { setSessionCookies } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { clearChallenge, parseTransports, readChallenge, relyingParty } from "@/lib/passkey";

/** パスキーでログインする第2段階。署名を確かめ、パスワードのログインと同じセッションを発行する */
export async function POST(request: NextRequest) {
  const fail = (message: string, status = 401) => {
    const res = NextResponse.json({ success: false, message }, { status });
    clearChallenge(res);
    return res;
  };

  const stored = await readChallenge(request, "login");
  if (!stored) return fail("時間が経ちすぎました。もう一度「パスキーでログイン」を押してください", 400);

  try {
    const body = await request.json();
    const credentialId = typeof body?.id === "string" ? body.id : "";
    const passkey = credentialId
      ? await prisma.passkey.findUnique({
          where: { id: credentialId },
          include: { user: { select: { id: true, email: true, name: true, role: true, isActive: true } } },
        })
      : null;
    // 登録されていない・削除済みのパスキー、無効にしたユーザーは同じ文言で断る
    if (!passkey || !passkey.user.isActive) {
      return fail("このパスキーは登録されていません。パスワードでログインしてください");
    }

    const { rpID, origin } = relyingParty(request);
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.id,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: passkey.counter,
        transports: parseTransports(passkey.transports),
      },
      requireUserVerification: true,
    });
    if (!verification.verified) return fail("パスキーを確認できませんでした");

    await prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
        backedUp: verification.authenticationInfo.credentialBackedUp,
        lastUsedAt: new Date(),
      },
    });

    const { user } = passkey;
    await writeAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: "login",
      target: "session",
      detail: `${user.name}（${user.role}）がパスキーでログイン（${passkey.name}）`,
    });

    const res = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
    clearChallenge(res);
    await setSessionCookies(res, user);
    return res;
  } catch (error) {
    console.error("Passkey login error:", error);
    return fail("パスキーでログインできませんでした");
  }
}
