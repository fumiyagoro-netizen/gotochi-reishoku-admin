import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnlessSiteManager, siteAuditLog } from "@/lib/site-api";
import { parseYouTubeId } from "@/lib/site-collections";

// ダイジェストムービー（年度ごと）。サイト管理だけ。URL を貼られても動画IDだけ取り出す
export async function PUT(request: NextRequest, { params }: { params: Promise<{ awardId: string }> }) {
  const denied = await denyUnlessSiteManager(request);
  if (denied) return denied;

  try {
    const { awardId: raw } = await params;
    const awardId = parseInt(raw);
    const award = await prisma.award.findUnique({ where: { id: awardId }, select: { id: true, year: true } });
    if (!award) return NextResponse.json({ success: false, message: "年度が見つかりません" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const input = typeof body.digestVideoId === "string" ? body.digestVideoId.trim() : "";
    const digestVideoId = input ? parseYouTubeId(input) : "";
    if (input && !digestVideoId) {
      return NextResponse.json({ success: false, message: "YouTube の動画ID（または動画のURL）を入れてください" }, { status: 400 });
    }
    const digestCaption = typeof body.digestCaption === "string" ? body.digestCaption.trim().slice(0, 200) : "";

    await prisma.siteAwardSettings.upsert({
      where: { awardId },
      create: { awardId, digestVideoId, digestCaption },
      update: { digestVideoId, digestCaption },
    });
    await siteAuditLog(request, "digest", awardId, `${award.year}年度のダイジェストムービーを${digestVideoId ? "設定" : "未設定に"}`);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Site digest save error:", e);
    return NextResponse.json({ success: false, message: "保存中にエラーが発生しました" }, { status: 500 });
  }
}
