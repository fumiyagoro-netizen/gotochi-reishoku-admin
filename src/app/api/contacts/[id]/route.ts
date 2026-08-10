import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { setContactLists } from "@/lib/contact";

const EDITABLE_FIELDS = ["name", "companyName", "phone", "note", "subscribed", "email"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canManageContacts || !perms.canEdit) {
      return NextResponse.json(
        { success: false, message: "編集権限がありません" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const contactId = parseInt(id);
    const body = await request.json();

    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) {
      return NextResponse.json(
        { success: false, message: "連絡先が見つかりません" },
        { status: 404 }
      );
    }

    if ("email" in body) {
      const normalizedEmail = String(body.email ?? "").trim().toLowerCase();
      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        return NextResponse.json(
          { success: false, message: "有効なメールアドレスを入力してください" },
          { status: 400 }
        );
      }
      if (normalizedEmail !== contact.email) {
        const duplicate = await prisma.contact.findUnique({ where: { email: normalizedEmail } });
        if (duplicate && duplicate.id !== contactId) {
          return NextResponse.json(
            { success: false, message: "このメールアドレスは既に登録されています" },
            { status: 400 }
          );
        }
      }
      body.email = normalizedEmail;
    }

    const data: Record<string, unknown> = {};
    const changes: string[] = [];
    for (const key of EDITABLE_FIELDS) {
      if (key in body) {
        const oldVal = String((contact as Record<string, unknown>)[key] ?? "");
        const newVal = String(body[key]);
        if (oldVal !== newVal) {
          changes.push(`${key}: "${oldVal}" → "${newVal}"`);
        }
        data[key] = key === "subscribed" ? Boolean(body[key]) : body[key];
      }
    }

    const updated = await prisma.contact.update({
      where: { id: contactId },
      data,
    });

    // listIds が body に無ければリスト所属には一切触れない（スカラー項目だけの
    // 更新でリストが消えることを防ぐ）。存在する場合のみ完全同期する。
    if ("listIds" in body) {
      const listIds = Array.isArray(body.listIds)
        ? body.listIds.map((v: unknown) => Number(v)).filter((n: number) => Number.isFinite(n))
        : [];

      const before = await prisma.contactListMembership.findMany({
        where: { contactId },
        include: { list: { select: { name: true } } },
      });
      const beforeNames = before.map((m) => m.list.name).sort();

      await setContactLists(contactId, listIds);

      const afterLists =
        listIds.length > 0
          ? await prisma.contactList.findMany({
              where: { id: { in: listIds } },
              select: { name: true },
            })
          : [];
      const afterNames = afterLists.map((l) => l.name).sort();

      if (beforeNames.join(",") !== afterNames.join(",")) {
        changes.push(`リスト: ${afterNames.length > 0 ? afterNames.join(", ") : "なし"}`);
      }
    }

    const user = await getUserFromRequest(request);
    if (changes.length > 0) {
      await writeAuditLog({
        userId: user?.userId,
        userEmail: user?.email,
        action: "update",
        target: "contact",
        targetId: String(contactId),
        detail: `${contact.email}: ${changes.join(", ")}`,
      });
    }

    return NextResponse.json({ success: true, contact: updated });
  } catch (error) {
    console.error("Update contact error:", error);
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
    if (!perms.canManageContacts || !perms.canDelete) {
      return NextResponse.json(
        { success: false, message: "削除権限がありません" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const contactId = parseInt(id);

    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) {
      return NextResponse.json(
        { success: false, message: "連絡先が見つかりません" },
        { status: 404 }
      );
    }

    await prisma.contact.delete({ where: { id: contactId } });

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "delete",
      target: "contact",
      targetId: String(contactId),
      detail: `連絡先削除: ${contact.email}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete contact error:", error);
    return NextResponse.json(
      { success: false, message: "削除中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
