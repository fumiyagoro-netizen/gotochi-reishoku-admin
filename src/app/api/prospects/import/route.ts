import { NextRequest, NextResponse } from "next/server";
import { resolveAwardId, resolveAwardYear } from "@/lib/award";
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

    // 取込先は「今サイドバーで選択中の年度」— インポート画面
    // (src/app/prospects/import/page.tsx) が URL の ?year= をそのまま
    // form の year フィールドとして送ってくる。
    const yearField = formData.get("year");
    const awardId = await resolveAwardId(typeof yearField === "string" ? yearField : undefined);
    if (!awardId) {
      return NextResponse.json(
        { success: false, message: "取込先の年度が見つかりません" },
        { status: 400 }
      );
    }
    const year = await resolveAwardYear(typeof yearField === "string" ? yearField : undefined);

    const buffer = Buffer.from(await file.arrayBuffer());

    let result;
    try {
      result = await importProspectsFromExcel(buffer, awardId);
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
      detail: `Excelインポート（${year}年度）: 新規${result.created}件 / スキップ${skipped}件（重複${result.skippedDuplicate}件・メーカー名未入力${result.skippedInvalid}件）`,
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
