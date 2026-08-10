import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { isProspectContactStatus } from "@/lib/prospect-shared";

const EDITABLE_FIELDS = [
  "makerName",
  "prefecture",
  "productName",
  "tempZone",
  "supplement",
  "url",
  "contactStatus",
  "assignee",
  "email",
  "phone",
  "memo",
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canManageProspects) {
      return NextResponse.json(
        { success: false, message: "編集権限がありません" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const prospectId = parseInt(id);
    const body = await request.json();

    const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
    if (!prospect) {
      return NextResponse.json(
        { success: false, message: "対象のデータが見つかりません" },
        { status: 404 }
      );
    }

    if ("makerName" in body && !String(body.makerName ?? "").trim()) {
      return NextResponse.json(
        { success: false, message: "メーカー名は必須です" },
        { status: 400 }
      );
    }
    if ("contactStatus" in body && !isProspectContactStatus(body.contactStatus)) {
      return NextResponse.json(
        { success: false, message: "コンタクト状況の値が不正です" },
        { status: 400 }
      );
    }

    const data: Record<string, string> = {};
    const changes: string[] = [];
    for (const key of EDITABLE_FIELDS) {
      if (key in body) {
        const oldVal = String((prospect as Record<string, unknown>)[key] ?? "");
        const newVal = String(body[key] ?? "");
        if (oldVal !== newVal) {
          changes.push(`${key}: "${oldVal}" → "${newVal}"`);
        }
        data[key] = newVal;
      }
    }

    const updated = await prisma.prospect.update({
      where: { id: prospectId },
      data,
    });

    const user = await getUserFromRequest(request);
    if (changes.length > 0) {
      await writeAuditLog({
        userId: user?.userId,
        userEmail: user?.email,
        action: "update",
        target: "prospect",
        targetId: String(prospectId),
        detail: `${prospect.makerName}: ${changes.join(", ")}`,
      });
    }

    return NextResponse.json({ success: true, prospect: updated });
  } catch (error) {
    console.error("Update prospect error:", error);
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
    // Deliberately gated on canManageProspects alone, unlike contacts/forms:
    // canDelete is false for representative and editor, and this is a list
    // they maintain themselves, so requiring it would leave them unable to
    // remove a row they added by mistake. The UI asks for confirmation
    // before calling this.
    if (!perms.canManageProspects) {
      return NextResponse.json(
        { success: false, message: "削除権限がありません" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const prospectId = parseInt(id);

    const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
    if (!prospect) {
      return NextResponse.json(
        { success: false, message: "対象のデータが見つかりません" },
        { status: 404 }
      );
    }

    await prisma.prospect.delete({ where: { id: prospectId } });

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "delete",
      target: "prospect",
      targetId: String(prospectId),
      detail: `追客リスト削除: ${prospect.makerName}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete prospect error:", error);
    return NextResponse.json(
      { success: false, message: "削除中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
