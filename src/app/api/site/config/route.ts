import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnlessSiteManager, deleteSiteAssets, isSiteAssetUrl, siteAuditLog } from "@/lib/site-api";
import { jstDateStringToStartOfDayUtc, jstDateStringToEndOfDayUtc } from "@/lib/award-dates";
import { normalizeFooterLinks } from "@/lib/site-config-shared";

// サイト全体の設定（バナー・OGP・フッター・プライバシーポリシー・実績数・媒体名）。サイト管理だけ。
// 1行しか使わないので id=1 を upsert する。
export async function PUT(request: NextRequest) {
  const denied = await denyUnlessSiteManager(request);
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => ({}));
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const num = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
    };

    const bannerText = str(body.bannerText, 200);
    const bannerLinkText = str(body.bannerLinkText, 40);
    const bannerUrl = str(body.bannerUrl, 500);
    if (bannerUrl && !/^(https?:\/\/|\/)/.test(bannerUrl)) {
      return NextResponse.json({ success: false, message: "バナーのリンク先は http:// か / で始めてください" }, { status: 400 });
    }
    const bannerOn = body.bannerOn === true;
    if (bannerOn && !bannerText) {
      return NextResponse.json({ success: false, message: "バナーを表示するには文言を入れてください" }, { status: 400 });
    }
    // 期間は「その日いっぱい表示」にしたいので、開始は 0:00、終了は 23:59:59（JST）
    const fromStr = str(body.bannerFrom, 10);
    const toStr = str(body.bannerTo, 10);
    const bannerFrom = fromStr ? jstDateStringToStartOfDayUtc(fromStr) : null;
    const bannerTo = toStr ? jstDateStringToEndOfDayUtc(toStr) : null;
    if ((fromStr && !bannerFrom) || (toStr && !bannerTo)) {
      return NextResponse.json({ success: false, message: "バナーの期間は YYYY-MM-DD の形で入れてください" }, { status: 400 });
    }
    if (bannerFrom && bannerTo && bannerFrom > bannerTo) {
      return NextResponse.json({ success: false, message: "バナーの表示終了が開始より前になっています" }, { status: 400 });
    }

    const ogImageUrl = str(body.ogImageUrl, 1000);
    if (ogImageUrl && !isSiteAssetUrl(ogImageUrl)) {
      return NextResponse.json({ success: false, message: "OGP画像はこの画面からアップロードしてください" }, { status: 400 });
    }
    const { links, error } = normalizeFooterLinks(body.footerLinks);
    if (error) return NextResponse.json({ success: false, message: error }, { status: 400 });

    const privacyStr = str(body.privacyUpdatedAt, 10);
    const privacyUpdatedAt = privacyStr ? jstDateStringToStartOfDayUtc(privacyStr) : null;
    if (privacyStr && !privacyUpdatedAt) {
      return NextResponse.json({ success: false, message: "プライバシーポリシーの更新日は YYYY-MM-DD の形で入れてください" }, { status: 400 });
    }

    // 送られてきた項目だけ更新する（バナー画面とムービー・メディア画面が別々の項目を保存するため）
    const all: Record<string, unknown> = {
      bannerOn, bannerTag: str(body.bannerTag, 20), bannerText, bannerLinkText, bannerUrl, bannerFrom, bannerTo,
      ogTitle: str(body.ogTitle, 200), ogDescription: str(body.ogDescription, 400), ogImageUrl,
      footerLinks: links, privacyBody: str(body.privacyBody, 20000), privacyUpdatedAt,
      mediaOutlets: str(body.mediaOutlets, 2000),
      statsEntries: num(body.statsEntries), statsPrefectures: Math.min(num(body.statsPrefectures), 47),
    };
    const BANNER_KEYS = ["bannerOn", "bannerTag", "bannerText", "bannerLinkText", "bannerUrl", "bannerFrom", "bannerTo"];
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(all)) {
      const sent = key in body || (BANNER_KEYS.includes(key) && BANNER_KEYS.some((k) => k in body));
      if (sent) data[key] = value;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, message: "変更する項目がありません" }, { status: 400 });
    }

    const current = await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { ogImageUrl: true } });
    await prisma.siteConfig.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
    if (current?.ogImageUrl && current.ogImageUrl !== ogImageUrl) await deleteSiteAssets([current.ogImageUrl]);

    await siteAuditLog(request, "config", 1, "サイト設定を保存");
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Site config save error:", e);
    return NextResponse.json({ success: false, message: "保存中にエラーが発生しました" }, { status: 500 });
  }
}
