import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createToken, COOKIE_NAME, TOKEN_MAX_AGE } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import type { Role } from "@/lib/role-shared";

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

    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role as Role,
    });

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

    res.cookies.set(COOKIE_NAME, token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: TOKEN_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });

    // Also set the role cookie for backward compatibility
    res.cookies.set("role", user.role, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: TOKEN_MAX_AGE,
    });

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
