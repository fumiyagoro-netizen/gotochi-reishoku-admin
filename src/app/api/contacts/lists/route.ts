import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

// GET: list all contact lists (with contact counts)
export async function GET() {
  const lists = await prisma.contactList.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { memberships: true } },
    },
  });
  return NextResponse.json({ success: true, lists });
}

// POST: create a new list
export async function POST(request: NextRequest) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canEdit) {
      return NextResponse.json(
        { success: false, message: "編集権限がありません" },
        { status: 403 }
      );
    }

    const body = await request.json();
    if (!body.name) {
      return NextResponse.json(
        { success: false, message: "リスト名は必須です" },
        { status: 400 }
      );
    }

    const list = await prisma.contactList.create({
      data: { name: body.name, description: body.description || "" },
    });

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "create",
      target: "contact_list",
      targetId: String(list.id),
      detail: `リスト作成: ${list.name}`,
    });

    return NextResponse.json({ success: true, list });
  } catch (error) {
    console.error("Create list error:", error);
    return NextResponse.json(
      { success: false, message: "リストの作成に失敗しました" },
      { status: 500 }
    );
  }
}
