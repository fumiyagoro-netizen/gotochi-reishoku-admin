import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnlessSiteManager, siteAuditLog } from "@/lib/site-api";
import { MAX_HERO_ENTRIES } from "@/lib/site-collections-shared";

// トップのヒーローに出す商品（年度ごと）。サイト管理だけ。
//   heroMode: "auto"（最新回のグランプリ＋最高金賞から自動）| "manual"
//   heroEntryIds: 手動のときの Entry.id の配列（最大4、並び順どおり）
// 手動で選べるのは、その商品自体がサイト公開（sitePublished）で、受賞が付いているものだけ。
// 年度をまたいで選べる（前回のグランプリを残したい、といった使い方ができる）。
export async function PUT(request: NextRequest, { params }: { params: Promise<{ awardId: string }> }) {
  const denied = await denyUnlessSiteManager(request);
  if (denied) return denied;

  try {
    const { awardId: raw } = await params;
    const awardId = parseInt(raw);
    const award = await prisma.award.findUnique({ where: { id: awardId }, select: { id: true, year: true } });
    if (!award) return NextResponse.json({ success: false, message: "年度が見つかりません" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const heroMode = body.heroMode === "manual" ? "manual" : "auto";
    const ids: number[] = Array.isArray(body.heroEntryIds) ? body.heroEntryIds.map(Number) : [];
    if (ids.some((id) => !Number.isInteger(id)) || new Set(ids).size !== ids.length) {
      return NextResponse.json({ success: false, message: "掲載商品の指定が正しくありません" }, { status: 400 });
    }
    if (ids.length > MAX_HERO_ENTRIES) {
      return NextResponse.json({ success: false, message: `掲載できるのは${MAX_HERO_ENTRIES}件までです` }, { status: 400 });
    }
    if (ids.length > 0) {
      const ok = await prisma.entry.count({ where: { id: { in: ids }, sitePublished: true, prizeLevel: { not: "" } } });
      if (ok !== ids.length) {
        return NextResponse.json(
          { success: false, message: "受賞していない、またはサイトで非公開にしている商品は選べません" },
          { status: 400 },
        );
      }
    }
    if (heroMode === "manual" && ids.length === 0) {
      return NextResponse.json({ success: false, message: "手動にするときは商品を1件以上選んでください" }, { status: 400 });
    }

    await prisma.siteAwardSettings.upsert({
      where: { awardId },
      create: { awardId, heroMode, heroEntryIds: ids },
      update: { heroMode, heroEntryIds: ids },
    });
    await siteAuditLog(request, "hero", awardId, `${award.year}年度のトップ掲載商品を${heroMode === "auto" ? "自動" : `手動（${ids.length}件）`}に設定`);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Site hero save error:", e);
    return NextResponse.json({ success: false, message: "保存中にエラーが発生しました" }, { status: 500 });
  }
}
