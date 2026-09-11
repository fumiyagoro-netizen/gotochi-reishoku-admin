import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnlessSiteManager, deleteSiteAssets, isSiteAssetUrl, siteAuditLog } from "@/lib/site-api";
import { jstDateStringToStartOfDayUtc } from "@/lib/award-dates";
import { normalizeOverview } from "@/lib/site-overview-shared";

// 開催概要（年度ごと）を保存する。サイト管理（canManageSite）だけ。
// body: { overview: SiteOverview, announceDate: "YYYY-MM-DD" | "", leafletUrl: string }
// 公開設定（受賞商品を公開・特別枠）は同じ SiteAwardSettings の行だが、ここでは触らない
export async function PUT(request: NextRequest, { params }: { params: Promise<{ awardId: string }> }) {
  const denied = await denyUnlessSiteManager(request);
  if (denied) return denied;

  try {
    const { awardId: raw } = await params;
    const awardId = parseInt(raw);
    const award = await prisma.award.findUnique({ where: { id: awardId }, select: { id: true, year: true } });
    if (!award) return NextResponse.json({ success: false, message: "年度が見つかりません" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const overview = normalizeOverview(body.overview);

    const announceStr = typeof body.announceDate === "string" ? body.announceDate : "";
    const announceDate = announceStr ? jstDateStringToStartOfDayUtc(announceStr) : null;
    if (announceStr && !announceDate) {
      return NextResponse.json({ success: false, message: "受賞発表日は YYYY-MM-DD の形で入れてください" }, { status: 400 });
    }
    const leafletUrl = typeof body.leafletUrl === "string" ? body.leafletUrl : "";
    if (leafletUrl && !isSiteAssetUrl(leafletUrl)) {
      return NextResponse.json({ success: false, message: "リーフレットはこの画面からアップロードしてください" }, { status: 400 });
    }

    const current = await prisma.siteAwardSettings.findUnique({ where: { awardId }, select: { leafletUrl: true } });
    await prisma.siteAwardSettings.upsert({
      where: { awardId },
      create: { awardId, overview, announceDate, leafletUrl },
      update: { overview, announceDate, leafletUrl },
    });
    if (current?.leafletUrl && current.leafletUrl !== leafletUrl) await deleteSiteAssets([current.leafletUrl]);

    await siteAuditLog(request, "overview", awardId, `${award.year}年度の開催概要を保存`);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Site overview save error:", e);
    return NextResponse.json({ success: false, message: "保存中にエラーが発生しました" }, { status: 500 });
  }
}
