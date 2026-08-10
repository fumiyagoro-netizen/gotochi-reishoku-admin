import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { addContactsToList } from "@/lib/contact";

// POST: add multiple existing contacts to a single list at once.
// Contacts already in the list are skipped (no error). Additive only —
// this route never removes contacts from a list.
export async function POST(request: NextRequest) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canManageContacts || !perms.canEdit) {
      return NextResponse.json(
        { success: false, message: "編集権限がありません" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const contactIds = Array.isArray(body.contactIds)
      ? body.contactIds.map((v: unknown) => Number(v)).filter((n: number) => Number.isFinite(n))
      : [];
    const listId = Number(body.listId);

    if (contactIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "連絡先が選択されていません" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(listId)) {
      return NextResponse.json(
        { success: false, message: "リストを選択してください" },
        { status: 400 }
      );
    }

    const list = await prisma.contactList.findUnique({ where: { id: listId } });
    if (!list) {
      return NextResponse.json(
        { success: false, message: "指定されたリストが見つかりません" },
        { status: 404 }
      );
    }

    const { added } = await addContactsToList(contactIds, listId);

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "update",
      target: "contact",
      detail: `リスト「${list.name}」に${added}件追加`,
    });

    const message =
      added > 0
        ? `${added}件をリストに追加しました`
        : "選択した連絡先はすでにすべてこのリストに含まれています";

    return NextResponse.json({ success: true, message, added });
  } catch (error) {
    console.error("Add contacts to list error:", error);
    return NextResponse.json(
      { success: false, message: "リストへの追加処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
