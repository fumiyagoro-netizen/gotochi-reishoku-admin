import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { siteAssetSrc } from "@/lib/site-collections-shared";

export const dynamic = "force-dynamic";

/**
 * 募集要項リーフレットの固定URL（/leaflet）。いま募集中の年度のリーフレットへ転送する。
 * チラシのQRコードや、旧サイトのPDFのURL（/wp-content/uploads/....pdf）からもここに来る。
 * リーフレットは管理画面の「開催概要」で差し替える。
 */
export async function GET(request: NextRequest) {
  const award = await prisma.award.findFirst({
    where: { isActive: true },
    select: { siteSettings: { select: { leafletUrl: true } } },
  });
  const url = award?.siteSettings?.leafletUrl;
  if (!url) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }
  return NextResponse.redirect(new URL(siteAssetSrc(url), request.url), 302);
}
