import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPermissions, getRoleFromRequest } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

// Comments are readable by every logged-in role (admin / representative /
// editor / viewer / judge). getRoleFromRequest() falls back to "viewer" for
// an unauthenticated request too, so role alone can't tell "viewer" apart
// from "not logged in" — we check getUserFromRequest() directly to
// explicitly reject anonymous requests (middleware already blocks these,
// but API routes in this codebase re-check rather than relying on it
// alone).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { success: false, message: "ログインが必要です" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const entryId = parseInt(id);

  const entry = await prisma.entry.findUnique({ where: { id: entryId } });
  if (!entry) {
    return NextResponse.json(
      { success: false, message: "エントリーが見つかりません" },
      { status: 404 }
    );
  }

  const comments = await prisma.entryComment.findMany({
    where: { entryId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, comments });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = await getRoleFromRequest(request);
  if (!getPermissions(role).canReviewComment) {
    return NextResponse.json(
      { success: false, message: "審査コメントを投稿する権限がありません" },
      { status: 403 }
    );
  }

  const user = await getUserFromRequest(request);
  const body = await request.json();
  const commentBody = typeof body?.body === "string" ? body.body.trim() : "";

  if (!commentBody) {
    return NextResponse.json(
      { success: false, message: "コメント本文を入力してください" },
      { status: 400 }
    );
  }

  const { id } = await params;
  const entryId = parseInt(id);

  const entry = await prisma.entry.findUnique({ where: { id: entryId } });
  if (!entry) {
    return NextResponse.json(
      { success: false, message: "エントリーが見つかりません" },
      { status: 404 }
    );
  }

  // Snapshot the author's display name at post time (User.name, falling
  // back to email) so the comment still shows who wrote it even after the
  // user account is later deleted.
  let authorName = user?.email ?? "";
  if (user?.userId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { name: true, email: true },
    });
    authorName = dbUser?.name || dbUser?.email || authorName;
  }

  const comment = await prisma.entryComment.create({
    data: {
      entryId,
      userId: user?.userId ?? null,
      authorName,
      body: commentBody,
    },
  });

  await writeAuditLog({
    userId: user?.userId,
    userEmail: user?.email,
    action: "comment",
    target: "entry",
    targetId: String(entryId),
    detail: `${entry.productName}（${entry.companyName}）に審査コメントを追加`,
  });

  return NextResponse.json({ success: true, comment });
}
