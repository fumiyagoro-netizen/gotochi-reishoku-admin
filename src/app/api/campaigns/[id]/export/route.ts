import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { loadCampaignRows } from "@/lib/retail";
import { DECISION_LABELS, RESPONSE_LABELS, formatJstDateTime, isDecision, isResponse } from "@/lib/retail-shared";

// GET: 企画の対象商品と回答・確定を Excel で（小売との調整や社内共有用）。
// 流通企画を見られる権限（canViewCampaigns）とダウンロード（canDownload）の組で通す
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const perms = getPermissions(await getRoleFromRequest(request));
    if (!perms.canViewCampaigns || !perms.canDownload) {
      return NextResponse.json({ success: false, message: "ダウンロード権限がありません" }, { status: 403 });
    }
    const campaignId = parseInt((await params).id);
    const campaign = Number.isInteger(campaignId)
      ? await prisma.retailCampaign.findUnique({ where: { id: campaignId } })
      : null;
    if (!campaign) return NextResponse.json({ success: false, message: "企画が見つかりません" }, { status: 404 });

    const rows = await loadCampaignRows(campaign);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(campaign.name.slice(0, 31).replace(/[\\/?*[\]:]/g, "_") || "流通企画");
    sheet.columns = [
      { header: "年度", key: "year", width: 8 },
      { header: "賞", key: "prize", width: 12 },
      { header: "商品名", key: "product", width: 32 },
      { header: "企業名", key: "company", width: 26 },
      { header: "企業の回答", key: "response", width: 12 },
      { header: "回答日時", key: "respondedAt", width: 18 },
      { header: "回答者", key: "respondent", width: 16 },
      { header: "回答者の連絡先", key: "respondentContact", width: 18 },
      { header: "企業からの連絡事項", key: "note", width: 36 },
      { header: "事務局の確定", key: "decision", width: 12 },
      { header: "事務局メモ", key: "memo", width: 30 },
      { header: "回答する担当者", key: "answerer", width: 16 },
      { header: "担当者のメールアドレス", key: "answererEmail", width: 30 },
    ];
    for (const r of rows) {
      sheet.addRow({
        year: r.year,
        prize: r.prizeLevel + (r.grandPrix ? "（グランプリ）" : ""),
        product: r.productName,
        company: r.companyName,
        response: isResponse(r.response) ? RESPONSE_LABELS[r.response] : r.response,
        respondedAt: formatJstDateTime(r.respondedAt) + (r.respondedVia === "staff" ? "（事務局が入力）" : ""),
        respondent: r.respondentName,
        respondentContact: r.respondentContact,
        note: r.companyNote,
        decision: isDecision(r.decision) ? DECISION_LABELS[r.decision] : r.decision,
        memo: r.staffMemo,
        answerer: r.answererName,
        answererEmail: r.answererEmail,
      });
    }
    sheet.getRow(1).font = { bold: true, size: 10 };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      row.alignment = { vertical: "middle", wrapText: true };
      row.font = { size: 10 };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const jstDateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }).replace(/-/g, "");
    const filename = `流通企画_${campaign.name}_${jstDateStr}.xlsx`;
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="campaign_${campaignId}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error("Campaign export error:", error);
    return NextResponse.json({ success: false, message: "エクスポートに失敗しました" }, { status: 500 });
  }
}
