import { NextRequest, NextResponse } from "next/server";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { importContactsFromCsv } from "@/lib/contact";

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

    const formData = await request.formData();
    const file = formData.get("csv") as File | null;
    const listIdStr = formData.get("listId") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "ファイルが選択されていません" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(buffer);
    const listId = listIdStr ? parseInt(listIdStr) : undefined;

    const result = await importContactsFromCsv(text, listId);

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "import_contacts",
      target: "contact",
      detail: `CSVインポート: ${result.created}件登録、${result.updated}件更新、${result.skipped}件スキップ`,
    });

    return NextResponse.json({
      success: true,
      message: `${result.created}件登録、${result.updated}件更新しました（${result.skipped}件スキップ）`,
      result,
    });
  } catch (error) {
    console.error("Import contacts error:", error);
    return NextResponse.json(
      { success: false, message: "インポート処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
