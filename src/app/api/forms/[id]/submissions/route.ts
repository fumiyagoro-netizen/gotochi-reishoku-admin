import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";

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
  const formId = parseInt(id);

  const form = await prisma.form.findUnique({ where: { id: formId } });
  if (!form) {
    return NextResponse.json(
      { success: false, message: "フォームが見つかりません" },
      { status: 404 }
    );
  }

  const submissions = await prisma.formSubmission.findMany({
    where: { formId },
    orderBy: { createdAt: "desc" },
  });

  const contactIds = [...new Set(submissions.map((s) => s.contactId).filter((id): id is number => id != null))];
  const contacts = contactIds.length
    ? await prisma.contact.findMany({
        where: { id: { in: contactIds } },
        select: { id: true, email: true, name: true },
      })
    : [];
  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  const submissionsWithContact = submissions.map((s) => ({
    ...s,
    contact: s.contactId != null ? contactMap.get(s.contactId) || null : null,
  }));

  return NextResponse.json({ success: true, form, submissions: submissionsWithContact });
}
