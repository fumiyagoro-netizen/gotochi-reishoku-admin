import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, hashPassword } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getUserFromRequest(request);
  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ success: false, message: "権限がありません" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const userId = parseInt(id);
    const body = await request.json();

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, message: "ユーザーが見つかりません" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.role !== undefined && ["admin", "editor", "viewer"].includes(body.role)) {
      data.role = body.role;
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.password) {
      data.password = await hashPassword(body.password);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ success: false, message: "更新に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getUserFromRequest(request);
  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ success: false, message: "権限がありません" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const userId = parseInt(id);

    // Prevent self-deletion
    if (userId === currentUser.userId) {
      return NextResponse.json(
        { success: false, message: "自分自身は削除できません" },
        { status: 400 }
      );
    }

    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ success: false, message: "削除に失敗しました" }, { status: 500 });
  }
}
