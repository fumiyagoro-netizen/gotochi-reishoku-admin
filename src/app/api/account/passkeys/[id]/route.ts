import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

/** 自分のパスキーを1つ削除する（なくした端末など）。ほかの人のパスキーは消せない */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const current = await getUserFromRequest(request);
  if (!current) {
    return NextResponse.json({ success: false, message: "ログインしてください" }, { status: 401 });
  }

  const { id } = await params;
  const passkey = await prisma.passkey.findUnique({ where: { id }, select: { userId: true, name: true } });
  if (!passkey || passkey.userId !== current.userId) {
    return NextResponse.json({ success: false, message: "パスキーが見つかりません" }, { status: 404 });
  }

  await prisma.passkey.delete({ where: { id } });
  await writeAuditLog({
    userId: current.userId,
    userEmail: current.email,
    action: "delete",
    target: "passkey",
    targetId: String(current.userId),
    detail: `パスキーを削除（${passkey.name}）`,
  });
  return NextResponse.json({ success: true });
}
