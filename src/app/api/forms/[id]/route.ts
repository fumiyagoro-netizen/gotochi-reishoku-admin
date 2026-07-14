import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const EDITABLE_FIELDS = [
  "title",
  "description",
  "status",
  "fields",
  "targetListId",
  "requireOptIn",
  "thankYouMessage",
  "slug",
  "autoReplyEnabled",
  "autoReplySubject",
  "autoReplyBody",
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = await getRoleFromRequest(request);
  const perms = getPermissions(role);
  if (!perms.canEdit) {
    return NextResponse.json(
      { success: false, message: "閲覧権限がありません" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const form = await prisma.form.findUnique({ where: { id: parseInt(id) } });
  if (!form) {
    return NextResponse.json(
      { success: false, message: "フォームが見つかりません" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, form });
}

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
    const formId = parseInt(id);
    const body = await request.json();

    const form = await prisma.form.findUnique({ where: { id: formId } });
    if (!form) {
      return NextResponse.json(
        { success: false, message: "フォームが見つかりません" },
        { status: 404 }
      );
    }

    if (body.slug && body.slug !== form.slug) {
      const existing = await prisma.form.findUnique({ where: { slug: body.slug } });
      if (existing) {
        return NextResponse.json(
          { success: false, message: "このURLは既に使用されています" },
          { status: 400 }
        );
      }
    }

    const data: Record<string, unknown> = {};
    for (const key of EDITABLE_FIELDS) {
      if (key in body) {
        if (key === "targetListId") {
          data[key] = body[key] ? parseInt(body[key]) : null;
        } else if (key === "requireOptIn" || key === "autoReplyEnabled") {
          data[key] = !!body[key];
        } else {
          data[key] = body[key];
        }
      }
    }

    const updated = await prisma.form.update({
      where: { id: formId },
      data,
    });

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "update",
      target: "form",
      targetId: String(formId),
      detail: `フォーム更新: ${updated.title}`,
    });

    return NextResponse.json({ success: true, form: updated });
  } catch (error) {
    console.error("Update form error:", error);
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
    const formId = parseInt(id);

    const form = await prisma.form.findUnique({ where: { id: formId } });
    if (!form) {
      return NextResponse.json(
        { success: false, message: "フォームが見つかりません" },
        { status: 404 }
      );
    }

    await prisma.form.delete({ where: { id: formId } });

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "delete",
      target: "form",
      targetId: String(formId),
      detail: `フォーム削除: ${form.title}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete form error:", error);
    return NextResponse.json(
      { success: false, message: "削除中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
