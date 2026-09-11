import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { parseImportWorkbook } from "@/lib/site-import";

// 過去の受賞商品の取り込み：Excel を読んで内容と問題点を返すだけ（保存はしない）。サイト管理（canManageSite）だけ。
export async function POST(request: NextRequest) {
  try {
    const role = await getRoleFromRequest(request);
    if (!getPermissions(role).canManageSite) {
      return NextResponse.json({ success: false, message: "サイト管理の権限がありません" }, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const year = parseInt(String(form.get("year") ?? ""));
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "Excel ファイルを選んでください" }, { status: 400 });
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ success: false, message: "取り込み先の年度を正しく入れてください" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, message: "Excel は5MBまでです" }, { status: 400 });
    }

    let parsed;
    try {
      parsed = await parseImportWorkbook(await file.arrayBuffer(), year);
    } catch (parseError) {
      // exceljs は Excel 以外で保存した一部の .xlsx（コメントの持ち方が違うもの等）を読めない。原因をログに残す
      console.error("Site import parse error:", parseError);
      return NextResponse.json(
        { success: false, message: "Excel を読み込めませんでした（Excel で開いて保存し直すと読めることがあります）" },
        { status: 400 },
      );
    }

    const award = await prisma.award.findUnique({ where: { year }, select: { id: true } });
    const existing = award
      ? await prisma.entry.findMany({
          where: { answerNo: { in: parsed.rows.map((r) => r.answerNo) } },
          select: { answerNo: true },
        })
      : [];
    const done = new Set(existing.map((e) => e.answerNo));

    return NextResponse.json({
      success: true,
      year,
      awardExists: !!award,
      fileErrors: parsed.fileErrors,
      rows: parsed.rows.map((r) => ({ ...r, exists: done.has(r.answerNo) })),
    });
  } catch (error) {
    console.error("Site import preview error:", error);
    return NextResponse.json({ success: false, message: "読み込み中にエラーが発生しました" }, { status: 500 });
  }
}
