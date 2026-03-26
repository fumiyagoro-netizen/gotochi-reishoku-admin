import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAwardId } from "@/lib/award";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

export async function GET(request: NextRequest) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canDownload) {
      return NextResponse.json(
        { success: false, message: "ダウンロード権限がありません" },
        { status: 403 }
      );
    }

    const year = request.nextUrl.searchParams.get("year") || undefined;
    const awardId = await resolveAwardId(year);

    const entries = await prisma.entry.findMany({
      where: awardId ? { awardId } : {},
      orderBy: { answeredAt: "desc" },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
      },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("エントリー一覧");

    const columns = [
      { header: "回答番号", key: "answerNo", width: 12 },
      { header: "回答日時", key: "answeredAt", width: 20 },
      { header: "企業名", key: "companyName", width: 25 },
      { header: "部署・役職", key: "department", width: 20 },
      { header: "担当者（姓）", key: "contactLastName", width: 12 },
      { header: "担当者（名）", key: "contactFirstName", width: 12 },
      { header: "メール", key: "email", width: 30 },
      { header: "電話番号", key: "phone", width: 15 },
      { header: "商品名", key: "productName", width: 30 },
      { header: "カテゴリ", key: "productCategory", width: 15 },
      { header: "販売価格", key: "price", width: 15 },
      { header: "購入可能場所", key: "purchaseLocation", width: 20 },
      { header: "参考URL", key: "referenceUrl", width: 30 },
      { header: "メイン画像", key: "mainImage", width: 18 },
      { header: "ご当地のこだわり", key: "localAppeal", width: 40 },
      { header: "おいしさのこだわり", key: "tasteAppeal", width: 40 },
      { header: "パッケージのこだわり", key: "packageAppeal", width: 40 },
      { header: "調理方法", key: "cookingMethod", width: 40 },
      { header: "その他アピール", key: "otherAppeal", width: 40 },
      { header: "トレードショー出展", key: "tradeShowExhibition", width: 15 },
      { header: "小売業者販売希望", key: "retailPartnership", width: 15 },
      { header: "食品細菌検査", key: "bacteriaInspection", width: 20 },
      { header: "賞味期限検査証", key: "expirationInspection", width: 20 },
      { header: "営業許可証（製造販売）", key: "manufacturingLicense", width: 20 },
      { header: "営業許可証（商品）", key: "entryProductLicense", width: 20 },
      { header: "食品衛生責任者", key: "hygieneManager", width: 20 },
      { header: "備考", key: "remarks", width: 30 },
    ];
    sheet.columns = columns;

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, size: 10 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8EDF5" },
    };
    headerRow.alignment = { vertical: "middle" };
    headerRow.height = 24;

    const publicDir = path.join(process.cwd(), "public");

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const rowIndex = i + 2;
      const mainImage = entry.images.find((img) => img.imageType === "main");

      sheet.addRow({
        answerNo: entry.answerNo,
        answeredAt: entry.answeredAt,
        companyName: entry.companyName,
        department: entry.department,
        contactLastName: entry.contactLastName,
        contactFirstName: entry.contactFirstName,
        email: entry.email,
        phone: entry.phone,
        productName: entry.productName,
        productCategory: entry.productCategory,
        price: entry.price,
        purchaseLocation: entry.purchaseLocation,
        referenceUrl: entry.referenceUrl,
        mainImage: "",
        localAppeal: entry.localAppeal,
        tasteAppeal: entry.tasteAppeal,
        packageAppeal: entry.packageAppeal,
        cookingMethod: entry.cookingMethod,
        otherAppeal: entry.otherAppeal,
        tradeShowExhibition: entry.tradeShowExhibition,
        retailPartnership: entry.retailPartnership,
        bacteriaInspection: entry.bacteriaInspection,
        expirationInspection: entry.expirationInspection,
        manufacturingLicense: entry.manufacturingLicense,
        entryProductLicense: entry.entryProductLicense,
        hygieneManager: entry.hygieneManager,
        remarks: entry.remarks,
      });

      // Embed main image if available
      if (mainImage) {
        const imagePath = path.join(publicDir, mainImage.imageUrl);
        if (fs.existsSync(imagePath)) {
          const ext = path.extname(imagePath).toLowerCase().replace(".", "");
          const imageId = workbook.addImage({
            filename: imagePath,
            extension: ext as "jpeg" | "png" | "gif",
          });
          sheet.addImage(imageId, {
            tl: { col: 13, row: rowIndex - 1 },
            ext: { width: 100, height: 75 },
          });
          sheet.getRow(rowIndex).height = 60;
        }
      }

      // Style data row
      const row = sheet.getRow(rowIndex);
      row.alignment = { vertical: "middle", wrapText: true };
      row.font = { size: 10 };
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="entries_${year || "all"}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { success: false, message: "エクスポートに失敗しました" },
      { status: 500 }
    );
  }
}
