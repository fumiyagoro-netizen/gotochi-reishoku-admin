import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { sendEmail } from "@/lib/email";

const REVIEW_LABELS: Record<string, string> = {
  rejected: "選外",
  first_passed: "1次審査通過",
  second_passed: "2次審査通過",
};

const EDITABLE_FIELDS = [
  "companyName",
  "department",
  "contactLastName",
  "contactFirstName",
  "email",
  "phone",
  "productName",
  "productCategory",
  "price",
  "purchaseLocation",
  "referenceUrl",
  "tradeShowExhibition",
  "retailPartnership",
  "localAppeal",
  "tasteAppeal",
  "packageAppeal",
  "cookingMethod",
  "otherAppeal",
  "bacteriaInspection",
  "expirationInspection",
  "manufacturingLicense",
  "entryProductLicense",
  "hygieneManager",
  "remarks",
  "prizeLevel",
  "reviewStatus",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    const body = await request.json();

    if (!perms.canEdit) {
      return NextResponse.json(
        { success: false, message: "編集権限がありません" },
        { status: 403 }
      );
    }

    if ("prizeLevel" in body && !perms.canSetPrize) {
      return NextResponse.json(
        { success: false, message: "受賞設定の権限がありません" },
        { status: 403 }
      );
    }

    if ("reviewStatus" in body && !perms.canSetPrize) {
      return NextResponse.json(
        { success: false, message: "審査状況設定の権限がありません" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const entryId = parseInt(id);

    const entry = await prisma.entry.findUnique({ where: { id: entryId } });
    if (!entry) {
      return NextResponse.json(
        { success: false, message: "エントリーが見つかりません" },
        { status: 404 }
      );
    }

    const data: Record<string, string> = {};
    const changes: string[] = [];
    for (const key of EDITABLE_FIELDS) {
      if (key in body) {
        const oldVal = String((entry as Record<string, unknown>)[key] || "");
        const newVal = String(body[key]);
        if (oldVal !== newVal) {
          changes.push(`${key}: "${oldVal}" → "${newVal}"`);
        }
        data[key] = newVal;
      }
    }

    const updated = await prisma.entry.update({
      where: { id: entryId },
      data,
    });

    // Audit log
    const user = await getUserFromRequest(request);
    if (changes.length > 0) {
      const isPrize = "prizeLevel" in body && Object.keys(body).length === 1;
      const isReview = "reviewStatus" in body && Object.keys(body).length === 1;
      await writeAuditLog({
        userId: user?.userId,
        userEmail: user?.email,
        action: isPrize ? "prize" : isReview ? "review" : "update",
        target: "entry",
        targetId: String(entryId),
        detail: `${entry.productName}（${entry.companyName}）: ${changes.join(", ")}`,
      });
    }

    // Send admin notification when review status changes
    if ("reviewStatus" in body && body.reviewStatus !== entry.reviewStatus) {
      const award = await prisma.award.findUnique({
        where: { id: entry.awardId },
        select: { name: true, notifyEmails: true },
      });
      if (award?.notifyEmails) {
        const adminEmails = award.notifyEmails.split(",").map((e: string) => e.trim()).filter(Boolean);
        if (adminEmails.length > 0) {
          const newStatuses = body.reviewStatus
            ? body.reviewStatus.split(",").filter(Boolean).map((s: string) => REVIEW_LABELS[s] || s).join("、")
            : "なし";
          const oldStatuses = entry.reviewStatus
            ? entry.reviewStatus.split(",").filter(Boolean).map((s: string) => REVIEW_LABELS[s] || s).join("、")
            : "なし";
          const changedBy = user?.email || "不明";

          await sendEmail({
            to: adminEmails,
            subject: `【審査状況変更】${entry.productName}（${entry.companyName}）`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #4338ca; border-bottom: 2px solid #4338ca; padding-bottom: 10px;">
                  審査状況変更通知
                </h2>
                <p>${award.name}のエントリーの審査状況が変更されました。</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                  <tr style="background: #f3f4f6;">
                    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; width: 140px;">商品名</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb;">${entry.productName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">企業名</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb;">${entry.companyName}</td>
                  </tr>
                  <tr style="background: #f3f4f6;">
                    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">変更前</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb;">${oldStatuses}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">変更後</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; color: #4338ca; font-weight: bold;">${newStatuses}</td>
                  </tr>
                  <tr style="background: #f3f4f6;">
                    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">変更者</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb;">${changedBy}</td>
                  </tr>
                </table>
                <p style="font-size: 14px;">
                  <a href="https://dashboard.gotouchireisyoku.com/entries/${entryId}" style="color: #4338ca;">管理画面で確認 →</a>
                </p>
              </div>
            `,
          });
        }
      }
    }

    return NextResponse.json({ success: true, entry: updated });
  } catch (error) {
    console.error("Update error:", error);
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
    const entryId = parseInt(id);

    const entry = await prisma.entry.findUnique({ where: { id: entryId } });
    if (!entry) {
      return NextResponse.json(
        { success: false, message: "エントリーが見つかりません" },
        { status: 404 }
      );
    }

    await prisma.entry.delete({ where: { id: entryId } });

    // Audit log
    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "delete",
      target: "entry",
      targetId: String(entryId),
      detail: `${entry.productName}（${entry.companyName}）を削除`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { success: false, message: "削除中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
