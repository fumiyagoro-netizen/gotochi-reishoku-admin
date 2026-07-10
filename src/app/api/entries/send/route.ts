import { NextRequest, NextResponse } from "next/server";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { sendMarketingEmail, renderMarketingPreview, sendTestEmail } from "@/lib/email";
import { resolveEntrySegment, type EntrySegmentFilter } from "@/lib/entry-mail";

function parseFilter(body: Record<string, unknown>): EntrySegmentFilter {
  const awardIds = Array.isArray(body.awardIds)
    ? body.awardIds.map((v) => Number(v)).filter((n) => Number.isFinite(n))
    : [];
  const reviewStatuses = Array.isArray(body.reviewStatuses)
    ? (body.reviewStatuses as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  const prizeLevels = Array.isArray(body.prizeLevels)
    ? (body.prizeLevels as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  return { awardIds, reviewStatuses, prizeLevels };
}

// Separate delivery flow for award applicants (Entry), independent of the
// Contact/ContactList marketing flow at /api/contacts/send. Same underlying
// send engine (sendMarketingEmail/renderMarketingPreview/sendTestEmail) is
// reused so Suppression / Contact.subscribed / EmailLog behave identically.
export async function POST(request: NextRequest) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canSendEmail) {
      return NextResponse.json(
        { success: false, message: "メール配信は管理者のみ実行できます" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { subject, html, defaultName, testEmail, preview, countOnly } = body;
    const filter = parseFilter(body);

    // Audience-size preview: no content required, just resolve the filter.
    if (countOnly) {
      if (filter.awardIds.length === 0) {
        return NextResponse.json({ success: true, count: 0 });
      }
      const recipients = await resolveEntrySegment(filter);
      return NextResponse.json({ success: true, count: recipients.length });
    }

    if (!subject || !html) {
      return NextResponse.json(
        { success: false, message: "件名と本文は必須です" },
        { status: 400 }
      );
    }

    // Content preview: render sample-personalized subject/html, do not send anything
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
        action: "send_entry_email_test",
        target: "entry_segment",
        targetId: testEmail,
        detail: `応募者向けテスト送信「${subject}」宛先: ${testEmail}`,
      });

      if (!testResult.success) {
        return NextResponse.json(
          { success: false, message: "テスト送信に失敗しました" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, message: "テスト送信しました" });
    }

    if (filter.awardIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "年度を1つ以上選択してください" },
        { status: 400 }
      );
    }

    const recipients = await resolveEntrySegment(filter);

    if (recipients.length === 0) {
      return NextResponse.json(
        { success: false, message: "送信対象の応募者が見つかりません" },
        { status: 400 }
      );
    }

    const user = await getUserFromRequest(request);
    const sentBy = user?.email || "";

    const result = await sendMarketingEmail({
      recipients: recipients.map((r) => ({ email: r.email, name: r.name })),
      subject,
      html,
      sentBy,
      defaultName,
    });

    const filterSummary = `年度:${filter.awardIds.join(",")} 審査状況:${
      filter.reviewStatuses.length ? filter.reviewStatuses.join(",") : "指定なし"
    } 受賞枠:${filter.prizeLevels.length ? filter.prizeLevels.join(",") : "指定なし"}`;

    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "send_entry_email",
      target: "entry_segment",
      targetId: filter.awardIds.join(","),
      detail: `件名「${subject}」[${filterSummary}]: ${result.sent}件送信、${result.failed}件失敗、${result.skipped}件スキップ`,
    });

    return NextResponse.json({
      success: true,
      message: `${result.sent}件送信しました（失敗${result.failed}件、スキップ${result.skipped}件）`,
      result,
    });
  } catch (error) {
    console.error("Send entry segment email error:", error);
    return NextResponse.json(
      { success: false, message: "送信処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
