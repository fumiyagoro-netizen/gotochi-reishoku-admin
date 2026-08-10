import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAwardId, resolveAwardYear } from "@/lib/award";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import ExcelJS from "exceljs";

// GET: export the 追客リスト (prospects) list as an Excel file, filtered the
// same way the list screen is (src/app/api/prospects/route.ts GET) so what's
// on screen is what comes out — no pagination, all matching rows.
export async function GET(request: NextRequest) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    // 追客リスト is gated by canManageProspects (feature access) paired with
    // canDownload (operation-level flag) — same pairing as the forms
    // submissions export (src/app/api/forms/[id]/submissions/export/route.ts).
    if (!perms.canManageProspects || !perms.canDownload) {
      return NextResponse.json(
        { success: false, message: "ダウンロード権限がありません" },
        { status: 403 }
      );
    }

    const params = request.nextUrl.searchParams;
    const q = params.get("q") || "";
    const contactStatus = params.get("contactStatus") || "";
    const prefecture = params.get("prefecture") || "";
    const yearParam = params.get("year") || undefined;
    const [awardId, year] = await Promise.all([
      resolveAwardId(yearParam),
      resolveAwardYear(yearParam),
    ]);

    // Same shape as the list GET's `where` — kept in sync deliberately so an
    // exported file always matches what's currently filtered on screen.
    const where = {
      AND: [
        awardId ? { awardId } : {},
        q
          ? {
              OR: [
                { makerName: { contains: q } },
                { productName: { contains: q } },
              ],
            }
          : {},
        contactStatus ? { contactStatus } : {},
        prefecture ? { prefecture } : {},
      ],
    };

    const prospects = await prisma.prospect.findMany({
      where,
      orderBy: { id: "asc" },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("追客リスト");

    const columns = [
      { header: "メーカー名", key: "makerName", width: 25 },
      { header: "県名", key: "prefecture", width: 10 },
      { header: "商品名", key: "productName", width: 25 },
      { header: "サイトで確認できる温度帯", key: "tempZone", width: 22 },
      { header: "補足", key: "supplement", width: 25 },
      { header: "URL", key: "url", width: 35 },
      { header: "コンタクト状況", key: "contactStatus", width: 15 },
      { header: "担当者", key: "assignee", width: 12 },
      { header: "連絡先（メールアドレス）", key: "email", width: 25 },
      { header: "連絡先（電話番号）", key: "phone", width: 15 },
      { header: "備考・メモ欄", key: "memo", width: 30 },
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

    for (const p of prospects) {
      sheet.addRow({
        makerName: p.makerName,
        prefecture: p.prefecture,
        productName: p.productName,
        tempZone: p.tempZone,
        supplement: p.supplement,
        url: p.url,
        contactStatus: p.contactStatus,
        assignee: p.assignee,
        email: p.email,
        phone: p.phone,
        memo: p.memo,
      });
    }

    const dataRowCount = sheet.rowCount;
    for (let i = 2; i <= dataRowCount; i++) {
      const row = sheet.getRow(i);
      row.alignment = { vertical: "middle", wrapText: true };
      row.font = { size: 10 };
    }

    const buffer = await workbook.xlsx.writeBuffer();

    // Filename carries the award year the file was scoped to, plus the date
    // it was generated — in JST, per this project's Asia/Tokyo-fixed policy.
    // "en-CA" formats as "YYYY-MM-DD" (same trick as
    // src/lib/award-dates.ts#utcToJstDateInputValue), which strips down to
    // "YYYYMMDD" for the filename.
    const jstDateStr = new Date()
      .toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" })
      .replace(/-/g, "");
    const yearLabel = year ?? yearParam ?? "全年度";
    const filename = `追客リスト_${yearLabel}年度_${jstDateStr}.xlsx`;

    // Neither existing export (entries, form submissions) uses a Japanese
    // filename, so there's no in-repo precedent to mirror here. A bare
    // filename="..." with non-ASCII bytes is invalid per RFC 6266/2616 and
    // some browsers mangle it, so this follows the RFC 6266 filename*
    // (UTF-8, percent-encoded) form with an ASCII fallback for clients that
    // don't understand it.
    const asciiFallback = `prospects_${yearLabel}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error("Prospects export error:", error);
    return NextResponse.json(
      { success: false, message: "エクスポートに失敗しました" },
      { status: 500 }
    );
  }
}
