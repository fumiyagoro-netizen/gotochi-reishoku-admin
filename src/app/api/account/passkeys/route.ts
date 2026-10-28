import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { clearChallenge, passkeyName, readChallenge, relyingParty } from "@/lib/passkey";

/** 自分のパスキーの一覧 */
export async function GET(request: NextRequest) {
  const current = await getUserFromRequest(request);
  if (!current) {
    return NextResponse.json({ success: false, message: "ログインしてください" }, { status: 401 });
  }

  const passkeys = await prisma.passkey.findMany({
    where: { userId: current.userId },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ success: true, passkeys });
}

/** パスキー登録の第2段階。ブラウザが作ったパスキーを確かめて保存する */
export async function POST(request: NextRequest) {
  const current = await getUserFromRequest(request);
  if (!current) {
    return NextResponse.json({ success: false, message: "ログインしてください" }, { status: 401 });
  }

  const stored = await readChallenge(request, "register");
  // 登録を始めた人とログイン中の人が違う（途中でログインし直した）場合も受け付けない
  if (!stored || stored.userId !== current.userId) {
    return NextResponse.json(
      { success: false, message: "時間が経ちすぎました。もう一度「パスキーを登録」を押してください" },
      { status: 400 },
    );
  }

  const fail = (message: string, status = 400) => {
    const res = NextResponse.json({ success: false, message }, { status });
    clearChallenge(res);
    return res;
  };

  try {
    const body = await request.json();
    const { rpID, origin } = relyingParty(request);
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!verification.verified) return fail("パスキーを確認できませんでした");

    const { credential, credentialDeviceType, credentialBackedUp, aaguid } = verification.registrationInfo;

    const exists = await prisma.passkey.findUnique({ where: { id: credential.id }, select: { id: true } });
    if (exists) return fail("このパスキーはすでに登録されています");

    const name = passkeyName(request.headers.get("user-agent"), aaguid);
    const passkey = await prisma.passkey.create({
      data: {
        id: credential.id,
        userId: current.userId,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: (credential.transports ?? []).join(","),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        name,
      },
      select: { id: true, name: true, createdAt: true, lastUsedAt: true },
    });

    await writeAuditLog({
      userId: current.userId,
      userEmail: current.email,
      action: "create",
      target: "passkey",
      targetId: String(current.userId),
      detail: `パスキーを登録（${name}）`,
    });

    const res = NextResponse.json({ success: true, passkey });
    clearChallenge(res);
    return res;
  } catch (error) {
    console.error("Passkey registration error:", error);
    return fail("パスキーを登録できませんでした");
  }
}
