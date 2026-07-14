import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { generateSlug } from "@/lib/form";

// GET: list all forms (with submission counts)
export async function GET(request: NextRequest) {
  const role = await getRoleFromRequest(request);
  const perms = getPermissions(role);
  if (!perms.canEdit) {
    return NextResponse.json(
      { success: false, message: "閲覧権限がありません" },
      { status: 403 }
    );
  }

  const forms = await prisma.form.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { submissions: true } },
    },
  });

  return NextResponse.json({ success: true, forms });
}

// POST: create a new form
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
    if (!body.title) {
      return NextResponse.json(
        { success: false, message: "タイトルは必須です" },
        { status: 400 }
      );
    }

    let slug = (body.slug || "").trim();
    if (slug) {
      const existing = await prisma.form.findUnique({ where: { slug } });
      if (existing) {
        return NextResponse.json(
          { success: false, message: "このURLは既に使用されています" },
          { status: 400 }
        );
      }
    } else {
      slug = await generateSlug(body.title);
    }

    const form = await prisma.form.create({
      data: {
        slug,
        title: body.title,
        description: body.description || "",
        status: body.status || "draft",
        fields: body.fields || [],
        targetListId: body.targetListId ? parseInt(body.targetListId) : null,
        requireOptIn: !!body.requireOptIn,
        thankYouMessage: body.thankYouMessage || "",
        autoReplyEnabled: !!body.autoReplyEnabled,
        autoReplySubject: body.autoReplySubject || "",
        autoReplyBody: body.autoReplyBody || "",
      },
    });

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "create",
      target: "form",
      targetId: String(form.id),
      detail: `フォーム作成: ${form.title}`,
    });

    return NextResponse.json({ success: true, form });
  } catch (error) {
    console.error("Create form error:", error);
    return NextResponse.json(
      { success: false, message: "フォームの作成に失敗しました" },
      { status: 500 }
    );
  }
}
