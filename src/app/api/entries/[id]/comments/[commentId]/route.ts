import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

// Deletion rule: the comment's own author may delete it, and "admin" may
// delete any comment regardless of author. Only roles with
// canReviewComment=true (currently "admin" / "representative" / "judge")
// can ever author a comment (see POST in ../route.ts), so this ownership
// check alone already keeps editor/viewer from deleting anything — there is
// no comment they could ever own.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const role = await getRoleFromRequest(request);
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { success: false, message: "ログインが必要です" },
      { status: 401 }
    );
  }

  const { id, commentId } = await params;
  const entryId = parseInt(id);
  const commentIdNum = parseInt(commentId);

  const comment = await prisma.entryComment.findUnique({ where: { id: commentIdNum } });
  if (!comment || comment.entryId !== entryId) {
    return NextResponse.json(
      { success: false, message: "コメントが見つかりません" },
      { status: 404 }
    );
  }

  const isOwnComment = comment.userId != null && comment.userId === user.userId;
  if (role !== "admin" && !isOwnComment) {
    return NextResponse.json(
      { success: false, message: "このコメントを削除する権限がありません" },
      { status: 403 }
    );
  }

  await prisma.entryComment.delete({ where: { id: commentIdNum } });

  await writeAuditLog({
    userId: user.userId,
    userEmail: user.email,
    action: "comment_delete",
    target: "entry",
    targetId: String(entryId),
    detail: `審査コメント（投稿者: ${comment.authorName || "不明"}）を削除`,
  });

  return NextResponse.json({ success: true });
}
