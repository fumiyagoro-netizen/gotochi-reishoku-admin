import { NextRequest, NextResponse } from "next/server";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { importEntriesToContacts } from "@/lib/contact";

export async function POST(request: NextRequest) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canUpload) {
      return NextResponse.json(
        { success: false, message: "インポート権限がありません" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const awardId = body.awardId ? parseInt(body.awardId) : undefined;

    const result = await importEntriesToContacts(awardId);

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "import_contacts",
      target: "contact",
      detail: `応募者取り込み（${result.listName}）: ${result.created}件登録、${result.updated}件更新、${result.skipped}件スキップ`,
    });

    return NextResponse.json({
      success: true,
      message: `${result.created}件登録、${result.updated}件更新しました（${result.listName}）`,
      result,
    });
  } catch (error) {
    console.error("Import entries to contacts error:", error);
    const message = error instanceof Error ? error.message : "取り込み処理中にエラーが発生しました";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
