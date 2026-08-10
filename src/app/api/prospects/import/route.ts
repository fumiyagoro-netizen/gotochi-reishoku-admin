import { NextRequest, NextResponse } from "next/server";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { importProspectsFromExcel } from "@/lib/prospect";

export async function POST(request: NextRequest) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canManageProspects || !perms.canUpload) {
      return NextResponse.json(
        { success: false, message: "インポート権限がありません" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { success: false, message: "ファイルが選択されていません" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let result;
    try {
      result = await importProspectsFromExcel(buffer);
    } catch (parseError) {
      console.error("Import prospects parse error:", parseError);
      return NextResponse.json(
        {
          success: false,
          message:
            parseError instanceof Error
              ? parseError.message
              : "Excelファイルの読み込みに失敗しました",
        },
        { status: 400 }
      );
    }

    const skipped = result.skippedDuplicate + result.skippedInvalid;

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "import_prospects",
      target: "prospect",
      detail: `Excelインポート: 新規${result.created}件 / スキップ${skipped}件（重複${result.skippedDuplicate}件・メーカー名未入力${result.skippedInvalid}件）`,
    });

    return NextResponse.json({
      success: true,
      message: `新規${result.created}件 / スキップ${skipped}件`,
      result,
    });
  } catch (error) {
    console.error("Import prospects error:", error);
    return NextResponse.json(
      { success: false, message: "インポート処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
