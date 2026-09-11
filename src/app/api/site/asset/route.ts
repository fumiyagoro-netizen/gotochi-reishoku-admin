import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { isSiteAssetUrl } from "@/lib/site-api";

/**
 * サイト用ファイル（審査員の写真・ロゴ・受賞者の声の写真・リーフレット）の配信。
 *
 * Blob ストアが private 設定のため、/api/site/upload は private で保存している。private の URL は
 * ブラウザで直接開けないので、ここで中継する（画面側は siteAssetSrc() でこのルートを指す）。
 *
 * 渡された URL は isSiteAssetUrl で「Vercel Blob の site/ 配下」に限る。site/ 配下は公開サイトに出すための
 * ファイルだけなので、応募者の添付（forms/）や商品写真（entries/ 等）はこのルートからは取れない。
 *
 * 今はログインが必要（middleware）。公開サイトを出すときに、src/lib/public-paths.ts の PUBLIC_PATHS に
 * "/api/site/asset" を足して誰でも読めるようにする（キャッシュも public に変える）。
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("u") || "";
  if (!isSiteAssetUrl(url)) {
    return NextResponse.json({ success: false, message: "見つかりません" }, { status: 404 });
  }

  try {
    const result = await get(url, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json({ success: false, message: "見つかりません" }, { status: 404 });
    }
    // 保存名は毎回ランダムなので、同じ URL の中身は変わらない。長めにキャッシュしてよい
    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType || "application/octet-stream",
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Site asset fetch error:", error);
    return NextResponse.json({ success: false, message: "ファイルの取得に失敗しました" }, { status: 500 });
  }
}
