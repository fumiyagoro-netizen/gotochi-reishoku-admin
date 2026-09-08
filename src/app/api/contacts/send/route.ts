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
    // editor already fails canSendEmail today, but canManageContacts is
    // checked too so this route stays blocked for anyone outside the
    // contacts feature even if canSendEmail is ever granted more broadly.
    if (!perms.canManageContacts || !perms.canSendEmail) {
      return NextResponse.json(
        { success: false, message: "メール配信は管理者のみ実行できます" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { contactIds, listId, listIds, excludeListIds, subject, html, defaultName, testEmail, preview } = body;

    // Accept either `listIds` (array, current UI) or the legacy singular
    // `listId` for backward compatibility with any other callers.
    const toIdList = (value: unknown): number[] =>
      (Array.isArray(value) ? value : [])
        .map((id: number | string) => parseInt(String(id), 10))
        .filter((id: number) => !Number.isNaN(id));

    const listIdList: number[] = toIdList(
      Array.isArray(listIds) ? listIds : listId != null ? [listId] : []
    );

    // 配信ごとの除外リスト。宛先の指定方法（リスト／個別選択）とは独立に効かせる
    // ので、下の where では送信先の条件と AND で組み合わせる。除外は常に勝つ:
    // 同じリストを宛先と除外の両方に指定すれば送信対象は 0 件になる。画面側は
    // 送信前に実際の件数を出すので、その状態は押す前に分かる。
    const excludeListIdList: number[] = toIdList(excludeListIds);

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

    if ((!Array.isArray(contactIds) || contactIds.length === 0) && listIdList.length === 0) {
      return NextResponse.json(
        { success: false, message: "送信先を選択してください" },
        { status: 400 }
      );
    }

    // `some` + `in` matches contacts belonging to any of the selected lists,
    // and Contact.findMany naturally dedupes at the contact level, so a
    // contact in multiple selected lists is still only fetched (and sent to) once.
    const targetWhere =
      listIdList.length > 0
        ? { memberships: { some: { listId: { in: listIdList } } } }
        : { id: { in: (contactIds as (number | string)[]).map(Number) } };

    const where =
      excludeListIdList.length > 0
        ? {
            AND: [
              targetWhere,
              { NOT: { memberships: { some: { listId: { in: excludeListIdList } } } } },
            ],
          }
        : targetWhere;

    // 除外して何件減ったかを記録・表示するため、除外前の件数も数えておく。
    const [contacts, targetTotal] = await Promise.all([
      prisma.contact.findMany({ where, select: { email: true, name: true } }),
      excludeListIdList.length > 0
        ? prisma.contact.count({ where: targetWhere })
        : Promise.resolve(0),
    ]);

    const excludedCount =
      excludeListIdList.length > 0 ? targetTotal - contacts.length : 0;

    if (contacts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            excludeListIdList.length > 0
              ? "除外リストを適用した結果、送信対象が0件になりました"
              : "送信対象の連絡先が見つかりません",
        },
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
      targetId:
        listIdList.length > 0
          ? `list:${listIdList.join(",")}`
          : (contactIds as (number | string)[]).join(","),
      detail:
        `件名「${subject}」: ${result.sent}件送信、${result.failed}件失敗、${result.skipped}件スキップ` +
        (excludeListIdList.length > 0
          ? `、除外リスト(${excludeListIdList.join(",")})で${excludedCount}件除外`
          : ""),
    });

    return NextResponse.json({
      success: true,
      message:
        `${result.sent}件送信しました（失敗${result.failed}件、スキップ${result.skipped}件` +
        (excludeListIdList.length > 0 ? `、除外${excludedCount}件` : "") +
        "）",
      result: { ...result, excluded: excludedCount },
    });
  } catch (error) {
    console.error("Send marketing email error:", error);
    return NextResponse.json(
      { success: false, message: "送信処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
