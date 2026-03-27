import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import Papa from "papaparse";

// CSV column name → DB field name mapping
const COLUMN_MAP: Record<string, string> = {
  "受付番号": "answerNo",
  "回答番号": "answerNo",
  "企業名": "companyName",
  "部署・役職": "department",
  "担当者（姓）": "contactLastName",
  "担当者（名）": "contactFirstName",
  "ご担当者名_姓": "contactLastName",
  "ご担当者名_名": "contactFirstName",
  "メール": "email",
  "メールアドレス": "email",
  "電話番号": "phone",
  "ご当地": "prefecture",
  "商品名": "productName",
  "カテゴリ": "productCategory",
  "商品カテゴリ": "productCategory",
  "販売価格": "price",
  "購入可能場所": "purchaseLocation",
  "参考URL": "referenceUrl",
  "ご当地のこだわり": "localAppeal",
  "おいしさのこだわり": "tasteAppeal",
  "パッケージのこだわり": "packageAppeal",
  "調理方法": "cookingMethod",
  "その他アピール": "otherAppeal",
  "トレードショー出展": "tradeShowExhibition",
  "小売業者販売希望": "retailPartnership",
  "食品細菌検査": "bacteriaInspection",
  "賞味期限検査証": "expirationInspection",
  "営業許可証（製造販売）": "manufacturingLicense",
  "営業許可証（商品）": "entryProductLicense",
  "食品衛生責任者": "hygieneManager",
  "備考・メッセージ": "remarks",
  "審査状況": "reviewStatus",
  "受賞": "prizeLevel",
};

// Fields that should NOT be updated
const READONLY_FIELDS = new Set(["answerNo", "id", "awardId", "createdAt", "answeredAt", "ipAddress"]);

export async function POST(request: NextRequest) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canUpload) {
      return NextResponse.json(
        { success: false, message: "アップロード権限がありません" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("csv") as File;
    if (!file) {
      return NextResponse.json(
        { success: false, message: "ファイルが選択されていません" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(buffer);

    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
    });

    if (result.data.length === 0) {
      return NextResponse.json(
        { success: false, message: "CSVにデータが含まれていません" },
        { status: 400 }
      );
    }

    // Find answerNo column
    const headers = Object.keys(result.data[0]);
    const answerNoHeader = headers.find(
      (h) => COLUMN_MAP[h] === "answerNo" || h === "answerNo"
    );

    if (!answerNoHeader) {
      return NextResponse.json(
        { success: false, message: "受付番号（回答番号）の列が見つかりません" },
        { status: 400 }
      );
    }

    let updated = 0;
    let notFound = 0;
    let skipped = 0;

    for (const row of result.data) {
      const answerNo = row[answerNoHeader]?.trim();
      if (!answerNo) {
        skipped++;
        continue;
      }

      const existing = await prisma.entry.findUnique({
        where: { answerNo },
      });

      if (!existing) {
        notFound++;
        continue;
      }

      // Build update data: only non-empty CSV values
      const updateData: Record<string, string> = {};
      for (const [csvCol, value] of Object.entries(row)) {
        const dbField = COLUMN_MAP[csvCol] || csvCol;
        if (READONLY_FIELDS.has(dbField)) continue;
        if (!value || !value.trim()) continue; // skip empty values

        // Only update if value is different from existing
        const existingValue = (existing as Record<string, unknown>)[dbField];
        if (existingValue !== value.trim()) {
          updateData[dbField] = value.trim();
        }
      }

      if (Object.keys(updateData).length === 0) {
        skipped++;
        continue;
      }

      await prisma.entry.update({
        where: { answerNo },
        data: updateData,
      });

      updated++;
    }

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "update",
      target: "entry",
      detail: `CSV一括更新: ${updated}件更新、${notFound}件該当なし、${skipped}件スキップ`,
    });

    return NextResponse.json({
      success: true,
      message: `${updated}件のエントリーを更新しました（${notFound}件該当なし、${skipped}件スキップ）`,
    });
  } catch (error) {
    console.error("CSV update error:", error);
    return NextResponse.json(
      { success: false, message: "更新処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
