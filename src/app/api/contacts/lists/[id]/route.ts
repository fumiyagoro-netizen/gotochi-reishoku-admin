import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canEdit) {
      return NextResponse.json(
        { success: false, message: "編集権限がありません" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const listId = parseInt(id);
    const body = await request.json();

    const list = await prisma.contactList.findUnique({ where: { id: listId } });
    if (!list) {
      return NextResponse.json(
        { success: false, message: "リストが見つかりません" },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;

    const updated = await prisma.contactList.update({
      where: { id: listId },
      data,
    });

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "update",
      target: "contact_list",
      targetId: String(listId),
      detail: `リスト更新: ${list.name} → ${updated.name}`,
    });

    return NextResponse.json({ success: true, list: updated });
  } catch (error) {
    console.error("Update list error:", error);
    return NextResponse.json(
      { success: false, message: "更新に失敗しました" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canDelete) {
      return NextResponse.json(
        { success: false, message: "削除権限がありません" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const listId = parseInt(id);

    const list = await prisma.contactList.findUnique({ where: { id: listId } });
    if (!list) {
      return NextResponse.json(
        { success: false, message: "リストが見つかりません" },
        { status: 404 }
      );
    }

    await prisma.contactList.delete({ where: { id: listId } });

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "delete",
      target: "contact_list",
      targetId: String(listId),
      detail: `リスト削除: ${list.name}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete list error:", error);
    return NextResponse.json(
      { success: false, message: "削除中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
