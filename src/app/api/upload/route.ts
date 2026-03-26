import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCsv, parseImageUrls, mapCsvRowToEntry } from "@/lib/csv-parser";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

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

    const yearStr = formData.get("year") as string | null;
    let awardId: number;

    if (yearStr) {
      const yearNum = parseInt(yearStr);
      const award = await prisma.award.upsert({
        where: { year: yearNum },
        update: {},
        create: { year: yearNum, name: `${yearNum}年度 ご当地冷凍食品大賞` },
      });
      awardId = award.id;
    } else {
      let latest = await prisma.award.findFirst({ orderBy: { year: "desc" } });
      if (!latest) {
        const currentYear = new Date().getFullYear();
        latest = await prisma.award.create({
          data: { year: currentYear, name: `${currentYear}年度 ご当地冷凍食品大賞` },
        });
      }
      awardId = latest.id;
    }

    const buffer = await file.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(buffer);
    const rows = parseCsv(text);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "CSVにデータが含まれていません" },
        { status: 400 }
      );
    }

    let created = 0;
    let skipped = 0;

    for (const row of rows) {
      const data = mapCsvRowToEntry(row);
      if (!data.answerNo) {
        skipped++;
        continue;
      }

      const existing = await prisma.entry.findUnique({
        where: { answerNo: data.answerNo },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const entry = await prisma.entry.create({
        data: { ...data, awardId },
      });

      const images = parseImageUrls(data.productPhotosRaw);
      if (images.length > 0) {
        await prisma.entryImage.createMany({
          data: images.map((img) => ({
            entryId: entry.id,
            imageUrl: img.url,
            imageType: img.type,
            sortOrder: img.sortOrder,
          })),
        });
      }

      created++;
    }

    // Audit log
    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "upload",
      target: "entry",
      detail: `CSVアップロード: ${created}件登録、${skipped}件スキップ`,
    });

    return NextResponse.json({
      success: true,
      message: `${created}件のエントリーを登録しました（${skipped}件スキップ）`,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, message: "アップロード処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
