import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import type { FormAnswers } from "@/lib/form-shared";

/** 回答を1件削除する。フォーム自体の削除と同じく canDelete も要求する
 *  （src/lib/role-shared.ts の方針: DELETE だけは operation 側の権限も見る）
 *  ため、現状は管理者のみ。 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; submissionId: string }> }
) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canManageForms || !perms.canDelete) {
      return NextResponse.json(
        { success: false, message: "回答を削除できるのは管理者のみです" },
        { status: 403 }
      );
    }

    const { id, submissionId } = await params;
    const formId = parseInt(id, 10);
    const subId = parseInt(submissionId, 10);
    if (Number.isNaN(formId) || Number.isNaN(subId)) {
      return NextResponse.json({ success: false, message: "不正な指定です" }, { status: 400 });
    }

    // formId も条件に入れる: 別フォームの回答IDを渡して消せてしまわないように。
    const submission = await prisma.formSubmission.findFirst({
      where: { id: subId, formId },
      include: { form: { select: { title: true } } },
    });
    if (!submission) {
      return NextResponse.json(
        { success: false, message: "回答が見つかりません" },
        { status: 404 }
      );
    }

    const answers = (submission.answers as unknown as FormAnswers) || {};
    const attachmentUrls = Object.values(answers)
      .flatMap((v) => (Array.isArray(v) ? v : [v]))
      .filter((v): v is string => typeof v === "string" && /^https?:\/\//.test(v));

    await prisma.formSubmission.delete({ where: { id: subId } });

    // 添付の実体も消す。DB を先に消しているのは、blob の削除に失敗しても
    // 「一覧には残っているのに開けない」状態を作らないため。逆順にすると
    // 削除済みファイルを指す回答が残りうる。取り残した blob は
    // 監査ログに URL が残るので後から辿れる。
    const failed: string[] = [];
    for (const url of attachmentUrls) {
      try {
        await del(url);
      } catch (err) {
        console.error("Attachment delete failed:", url, err);
        failed.push(url);
      }
    }

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "delete",
      target: "form_submission",
      targetId: String(subId),
      detail:
        `フォーム「${submission.form.title}」の回答を削除` +
        (attachmentUrls.length > 0 ? `（添付${attachmentUrls.length}件）` : "") +
        (failed.length > 0 ? ` ※添付の実体削除に失敗: ${failed.join(", ")}` : ""),
    });

    return NextResponse.json({ success: true, message: "回答を削除しました" });
  } catch (error) {
    console.error("Delete form submission error:", error);
    return NextResponse.json(
      { success: false, message: "削除に失敗しました" },
      { status: 500 }
    );
  }
}
