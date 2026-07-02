import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { sendMarketingEmail, renderMarketingPreview, sendTestEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canEdit) {
      return NextResponse.json(
        { success: false, message: "送信権限がありません" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { contactIds, listId, subject, html, defaultName, testEmail, preview } = body;

    if (!subject || !html) {
      return NextResponse.json(
        { success: false, message: "件名と本文は必須です" },
        { status: 400 }
      );
    }

    // Preview: render sample-personalized subject/html, do not send anything
    if (preview) {
      const renderedPreview = await renderMarketingPreview({ subject, html, defaultName });
      return NextResponse.json({ success: true, preview: renderedPreview });
    }

    // Test send: single email to testEmail with sample merge-tag data
    if (testEmail) {
      const user = await getUserFromRequest(request);
      const testResult = await sendTestEmail({
        to: testEmail,
        subject,
        html,
        defaultName,
        sentBy: user?.email || "",
      });

      await writeAuditLog({
        userId: user?.userId,
        userEmail: user?.email,
        action: "send_email_test",
        target: "contact",
        targetId: testEmail,
        detail: `テスト送信「${subject}」宛先: ${testEmail}`,
      });

      if (!testResult.success) {
        return NextResponse.json(
          { success: false, message: "テスト送信に失敗しました" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, message: "テスト送信しました" });
    }

    if ((!Array.isArray(contactIds) || contactIds.length === 0) && !listId) {
      return NextResponse.json(
        { success: false, message: "送信先を選択してください" },
        { status: 400 }
      );
    }

    const where = listId
      ? { memberships: { some: { listId: parseInt(listId) } } }
      : { id: { in: (contactIds as (number | string)[]).map(Number) } };

    const contacts = await prisma.contact.findMany({
      where,
      select: { email: true, name: true },
    });

    if (contacts.length === 0) {
      return NextResponse.json(
        { success: false, message: "送信対象の連絡先が見つかりません" },
        { status: 400 }
      );
    }

    const user = await getUserFromRequest(request);
    const sentBy = user?.email || "";

    const result = await sendMarketingEmail({
      recipients: contacts.map((c) => ({ email: c.email, name: c.name })),
      subject,
      html,
      sentBy,
      defaultName,
    });

    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "send_email",
      target: "contact",
      targetId: listId ? `list:${listId}` : (contactIds as (number | string)[]).join(","),
      detail: `件名「${subject}」: ${result.sent}件送信、${result.failed}件失敗、${result.skipped}件スキップ`,
    });

    return NextResponse.json({
      success: true,
      message: `${result.sent}件送信しました（失敗${result.failed}件、スキップ${result.skipped}件）`,
      result,
    });
  } catch (error) {
    console.error("Send marketing email error:", error);
    return NextResponse.json(
      { success: false, message: "送信処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
