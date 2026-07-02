import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const EDITABLE_FIELDS = ["name", "companyName", "phone", "note", "subscribed"];

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
    const contactId = parseInt(id);
    const body = await request.json();

    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) {
      return NextResponse.json(
        { success: false, message: "連絡先が見つかりません" },
        { status: 404 }
      );
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
    if (!perms.canDelete) {
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
