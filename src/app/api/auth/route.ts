import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, setSessionCookies, COOKIE_NAME } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "メールアドレスとパスワードを入力してください" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, message: "メールアドレスまたはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { success: false, message: "メールアドレスまたはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    // Audit log
    await writeAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: "login",
      target: "session",
      detail: `${user.name}（${user.role}）がログイン`,
    });

    const res = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });

    await setSessionCookies(res, user);

    return res;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, message: "ログインに失敗しました" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  res.cookies.set("role", "", { path: "/", maxAge: 0 });
  return res;
}
