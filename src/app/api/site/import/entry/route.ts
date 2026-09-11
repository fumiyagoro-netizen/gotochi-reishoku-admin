import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { GRAND_PRIX_TITLE } from "@/lib/prize-shared";
import {
  IMPORT_MAX_PHOTOS,
  importAnswerNo,
  validateImportRow,
  type ImportRow,
} from "@/lib/site-import-shared";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const SPECIAL_AWARD = "審査員特別賞";

// 過去の受賞商品の取り込み：1品を登録する。サイト管理（canManageSite）だけ。
// 画面が1品ずつ呼ぶ（写真を含めても Vercel の本文上限に収まるように）。
//   - 回答番号 IMPORT-<年度>-<No> が既にあれば何もしない（二重登録しない。途中で止まっても再実行で続きから）
//   - 年度が無ければ作る（受付はしない isActive=false）
//   - 写真は Vercel Blob（private）に保存し、1枚目をメインにする。DB 登録に失敗したら保存した写真を消す
// 行の中身は画面から受け取るが、サーバー側で検証し直す（画面の検証は信用しない）。
export async function POST(request: NextRequest) {
  const uploaded: string[] = [];
  try {
    const role = await getRoleFromRequest(request);
    if (!getPermissions(role).canManageSite) {
      return NextResponse.json({ success: false, message: "サイト管理の権限がありません" }, { status: 403 });
    }

    const form = await request.formData();
    const year = parseInt(String(form.get("year") ?? ""));
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ success: false, message: "取り込み先の年度が正しくありません" }, { status: 400 });
    }

    let raw: ImportRow;
    try {
      raw = JSON.parse(String(form.get("row") ?? ""));
    } catch {
      return NextResponse.json({ success: false, message: "行のデータが読めません" }, { status: 400 });
    }
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const row = validateImportRow({
      no: Number(raw.no),
      answerNo: importAnswerNo(year, Number(raw.no)),
      productName: str(raw.productName),
      sheetProductName: str(raw.sheetProductName),
      companyName: str(raw.companyName),
      prefecture: str(raw.prefecture),
      prizeLevel: str(raw.prizeLevel),
      grandPrix: raw.grandPrix === true,
      specialAward: str(raw.specialAward),
      referenceUrl: str(raw.referenceUrl),
      localAppeal: str(raw.localAppeal),
      tasteAppeal: str(raw.tasteAppeal),
      packageAppeal: str(raw.packageAppeal),
      cookingMethod: str(raw.cookingMethod),
      otherAppeal: str(raw.otherAppeal),
      price: str(raw.price),
      purchaseLocation: str(raw.purchaseLocation),
      volume: str(raw.volume),
      originalResult: str(raw.originalResult),
      photos: Array.isArray(raw.photos) ? raw.photos.map(str).filter(Boolean) : [],
      errors: [],
      warnings: [],
    });
    if (row.errors.length > 0) {
      return NextResponse.json({ success: false, message: row.errors.join("／") }, { status: 400 });
    }

    const files = form.getAll("photos").filter((f): f is File => f instanceof File);
    if (files.length !== row.photos.length || files.length > IMPORT_MAX_PHOTOS) {
      return NextResponse.json(
        { success: false, message: `写真の枚数が合いません（Excel: ${row.photos.length}枚、送信: ${files.length}枚）` },
        { status: 400 },
      );
    }
    for (const f of files) {
      if (!f.type.startsWith("image/") || f.size > MAX_PHOTO_BYTES) {
        return NextResponse.json(
          { success: false, message: `「${f.name}」は画像ではないか、4MBを超えています` },
          { status: 400 },
        );
      }
    }

    const existing = await prisma.entry.findUnique({ where: { answerNo: row.answerNo }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ success: true, status: "skipped", entryId: existing.id });
    }

    const award = await prisma.award.upsert({
      where: { year },
      update: {},
      create: { year, name: `ご当地冷凍食品大賞 ${year}` },
      select: { id: true },
    });

    for (const [i, f] of files.entries()) {
      const ext = (f.name.split(".").pop() || "webp").toLowerCase();
      const blob = await put(`entries/import-${year}/${row.answerNo}-${i + 1}.${ext}`, f, {
        access: "private",
        contentType: f.type,
        addRandomSuffix: true,
      });
      uploaded.push(blob.url);
    }

    const special = row.specialAward.startsWith(SPECIAL_AWARD)
      ? { name: SPECIAL_AWARD, note: row.specialAward.slice(SPECIAL_AWARD.length).trim() }
      : row.specialAward
        ? { name: row.specialAward, note: "" }
        : null;
    const remarks = [
      "過去データの取り込み（Excel）",
      row.sheetProductName && row.sheetProductName !== row.productName && `評価シート上の商品名: ${row.sheetProductName}`,
      row.originalResult && `評価シートの受賞結果: ${row.originalResult}`,
      row.volume && `内容量: ${row.volume}`,
    ]
      .filter(Boolean)
      .join("\n");

    const entry = await prisma.entry.create({
      data: {
        awardId: award.id,
        answerNo: row.answerNo,
        answeredAt: "",
        companyName: row.companyName,
        contactLastName: "",
        contactFirstName: "",
        email: "",
        prefecture: row.prefecture,
        productName: row.productName,
        price: row.price,
        purchaseLocation: row.purchaseLocation,
        referenceUrl: row.referenceUrl,
        localAppeal: row.localAppeal,
        tasteAppeal: row.tasteAppeal,
        packageAppeal: row.packageAppeal,
        cookingMethod: row.cookingMethod,
        otherAppeal: row.otherAppeal,
        remarks,
        prizeLevel: row.prizeLevel,
        source: "import",
        images: {
          create: uploaded.map((url, i) => ({ imageUrl: url, imageType: i === 0 ? "main" : "sub", sortOrder: i })),
        },
        titles: {
          create: [
            ...(row.grandPrix ? [{ name: GRAND_PRIX_TITLE, sortOrder: 0 }] : []),
            ...(special ? [{ name: special.name, note: special.note, sortOrder: 1 }] : []),
          ],
        },
      },
      select: { id: true },
    });

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "site_import",
      target: "entry",
      targetId: String(entry.id),
      detail: `${year}年度に取り込み: ${row.productName}（${row.companyName}）${row.prizeLevel}${row.grandPrix ? "・グランプリ" : ""}、写真${uploaded.length}枚`,
    });

    return NextResponse.json({ success: true, status: "created", entryId: entry.id });
  } catch (error) {
    console.error("Site import entry error:", error);
    if (uploaded.length > 0) {
      await del(uploaded).catch((e) => console.error("Failed to clean up uploaded photos:", e));
    }
    return NextResponse.json({ success: false, message: "登録中にエラーが発生しました" }, { status: 500 });
  }
}
