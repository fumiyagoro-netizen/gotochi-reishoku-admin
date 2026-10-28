import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

/**
 * 管理者がそのユーザーのパスキーをすべて解除する（退職・端末の紛失など）。
 * パスワードは残るので、解除後もパスワードではログインできる（止めるなら「有効」を外す）。
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const currentUser = await getUserFromRequest(request);
  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ success: false, message: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (!user) {
    return NextResponse.json({ success: false, message: "ユーザーが見つかりません" }, { status: 404 });
  }

  const { count } = await prisma.passkey.deleteMany({ where: { userId } });
  await writeAuditLog({
    userId: currentUser.userId,
    userEmail: currentUser.email,
    action: "delete",
    target: "passkey",
    targetId: String(userId),
    detail: `${user.name}のパスキーをすべて解除（${count}件）`,
  });
  return NextResponse.json({ success: true, count });
}
