import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { generateEntryPdf, type EntryPdfPhoto } from "@/lib/entry-pdf";

/**
 * GET /api/entries/[id]/pdf — エントリー1件を審査資料の PDF にする。
 *
 * 個人情報（担当者名・メール・電話・部署）と事務局の審査状況は、この
 * ルートでそもそも読まない。審査員に配るだけでなく後援・協賛にも共有する
 * ため、select に足す前に本当に外へ出してよい項目か確認すること。
 *
 * 権限は canDownload。画面の PDF ボタンと同じ条件（entry-detail.tsx）。
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = await getRoleFromRequest(request);
  if (!getPermissions(role).canDownload) {
    return NextResponse.json({ success: false, message: "ダウンロード権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const entryId = parseInt(id, 10);
  if (Number.isNaN(entryId)) {
    return NextResponse.json({ success: false, message: "不正な指定です" }, { status: 400 });
  }

  try {
    const entry = await prisma.entry.findUnique({
      where: { id: entryId },
      select: {
        answerNo: true,
        productName: true,
        companyName: true,
        prefecture: true,
        productCategory: true,
        price: true,
        purchaseLocation: true,
        referenceUrl: true,
        localAppeal: true,
        tasteAppeal: true,
        packageAppeal: true,
        cookingMethod: true,
        otherAppeal: true,
        tradeShowExhibition: true,
        retailPartnership: true,
        bacteriaInspection: true,
        expirationInspection: true,
        manufacturingLicense: true,
        entryProductLicense: true,
        hygieneManager: true,
        award: { select: { name: true } },
        images: {
          orderBy: [{ imageType: "asc" }, { sortOrder: "asc" }],
          select: { imageUrl: true, imageType: true },
        },
      },
    });
    if (!entry) {
      return NextResponse.json({ success: false, message: "エントリーが見つかりません" }, { status: 404 });
    }

    // 写真は最大4枚（メイン1＋サブ3）。全部入れると Vercel の 4.5MB 応答上限に
    // 近づくうえ、審査資料として1ページに並べられる枚数もこの程度が上限。
    const wanted = [
      ...entry.images.filter((i) => i.imageType === "main").slice(0, 1),
      ...entry.images.filter((i) => i.imageType !== "main").slice(0, 3),
    ];

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const photos: EntryPdfPhoto[] = [];
    for (const img of wanted) {
      try {
        const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0" };
        if (img.imageUrl.includes("private.blob.vercel-storage.com") && token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const res = await fetch(img.imageUrl, { headers });
        if (!res.ok) continue;
        photos.push({
          bytes: Buffer.from(await res.arrayBuffer()),
          isMain: img.imageType === "main",
        });
      } catch {
        // 1枚取れなくても資料自体は出す。写真だけ欠けるほうが、
        // 500 で何も出ないより運用上ましなため
      }
    }

    const pdfBytes = await generateEntryPdf({
      awardName: entry.award.name,
      answerNo: entry.answerNo,
      productName: entry.productName,
      companyName: entry.companyName,
      prefecture: entry.prefecture,
      productCategory: entry.productCategory,
      price: entry.price,
      purchaseLocation: entry.purchaseLocation,
      referenceUrl: entry.referenceUrl,
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
      photos,
    });

    const safe = entry.productName.replace(/[/\\?%*:|"<>]/g, "_");
    const filename = `${safe}_${entry.answerNo}.pdf`;
    const disposition = request.nextUrl.searchParams.get("download") ? "attachment" : "inline";

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          `${disposition}; filename="entry_${entry.answerNo}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error("Entry PDF generation error:", error);
    return NextResponse.json({ success: false, message: "PDFの生成に失敗しました" }, { status: 500 });
  }
}
