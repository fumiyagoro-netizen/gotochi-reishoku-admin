import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, hashPassword, verifyPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

/** 自分のパスワードを変える。今のパスワードを確かめてから変える（席を離れた間に変えられないように） */
export async function POST(request: NextRequest) {
  const current = await getUserFromRequest(request);
  if (!current) {
    return NextResponse.json({ success: false, message: "ログインしてください" }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await request.json();
    if (typeof currentPassword !== "string" || typeof newPassword !== "string" || !currentPassword || !newPassword) {
      return NextResponse.json({ success: false, message: "今のパスワードと新しいパスワードを入力してください" }, { status: 400 });
    }
    // ユーザー管理画面（管理者が設定する場合）と同じ下限
    if (newPassword.length < 6) {
      return NextResponse.json({ success: false, message: "新しいパスワードは6文字以上にしてください" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: current.userId }, select: { password: true, name: true } });
    if (!user || !(await verifyPassword(currentPassword, user.password))) {
      return NextResponse.json({ success: false, message: "今のパスワードが正しくありません" }, { status: 400 });
    }
    if (currentPassword === newPassword) {
      return NextResponse.json({ success: false, message: "今と同じパスワードです" }, { status: 400 });
    }

    await prisma.user.update({ where: { id: current.userId }, data: { password: await hashPassword(newPassword) } });
    await writeAuditLog({
      userId: current.userId,
      userEmail: current.email,
      action: "update",
      target: "password",
      targetId: String(current.userId),
      detail: `${user.name}が自分のパスワードを変更`,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ success: false, message: "パスワードを変更できませんでした" }, { status: 500 });
  }
}
