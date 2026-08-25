import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

// POST: 配信停止中の連絡先を手動で「購読中」に戻す（取引先本人から再開希望が
// あった場合の事務局対応用）。
//
// 特定電子メール法上、一度配信停止した相手に再送してよいのは本人からの
// 再開希望があった場合に限られ、事務局判断だけで勝手に戻してはいけない。
// そのため通常の連絡先編集（PATCH /api/contacts/[id] の EDITABLE_FIELDS 経由の
// subscribed 変更）とは別の専用エンドポイントにし、(1) 管理者限定、
// (2) 理由(reason)の入力必須、(3) 監査ログへの理由記録、を強制する。
//
// 送信除外判定（src/lib/email.ts の sendMarketingEmail）は Contact.subscribed
// と Suppression のどちらか一方でも該当すれば配信をスキップするため、実際に
// 配信を再開させるにはこの2つを必ず同時に解除する必要がある。
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // canManageContacts ではなく role === "admin" 限定（年度管理・設定と同じ
    // 流儀）。代表者・編集者は連絡先の編集はできても、配信停止解除という
    // 法令上の判断が必要な操作は行えない。
    const role = await getRoleFromRequest(request);
    if (role !== "admin") {
      return NextResponse.json(
        { success: false, message: "管理者のみ実行できます" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const contactId = parseInt(id);
    if (Number.isNaN(contactId)) {
      return NextResponse.json(
        { success: false, message: "連絡先が見つかりません" },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}) as Record<string, unknown>);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason) {
      return NextResponse.json(
        { success: false, message: "再開理由を入力してください" },
        { status: 400 }
      );
    }

    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) {
      return NextResponse.json(
        { success: false, message: "連絡先が見つかりません" },
        { status: 404 }
      );
    }

    // Contact.email は登録時に trim().toLowerCase() で保存されている
    // （src/lib/contact.ts の upsertContact）ので既に正規化済みだが、
    // Suppression 側（src/app/api/unsubscribe/route.ts でも同じ正規化）との
    // 照合に使い回す値だと明示するため、ここでも同じ正規化を通しておく。
    const email = contact.email.trim().toLowerCase();

    // Contact.subscribed の更新と Suppression 行の削除は必ず両方成功する
    // 必要がある（片方だけ成功すると「配信されない/されるが中途半端」な
    // 状態のまま残ってしまう — 上記コメント参照）ため、トランザクションで
    // 一括更新する。Suppression.deleteMany は該当行が無くても0件ヒットで
    // 成功する（エラーにならない）。
    const [updatedContact] = await prisma.$transaction([
      prisma.contact.update({
        where: { id: contactId },
        data: { subscribed: true },
      }),
      prisma.suppression.deleteMany({ where: { email } }),
    ]);

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "resubscribe",
      target: "contact",
      targetId: String(contactId),
      detail: `配信再開: ${email} / 理由: ${reason}`,
    });

    return NextResponse.json({ success: true, contact: updatedContact });
  } catch (error) {
    console.error("Resubscribe contact error:", error);
    return NextResponse.json(
      { success: false, message: "配信再開に失敗しました" },
      { status: 500 }
    );
  }
}
