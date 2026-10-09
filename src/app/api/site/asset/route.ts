import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import sharp from "sharp";
import { isSiteAssetUrl } from "@/lib/site-api";
import { IMAGE_WIDTHS } from "@/lib/site-collections-shared";

/**
 * サイト用ファイル（審査員の写真・ロゴ・受賞者の声の写真・リーフレット）の配信。
 *
 * Blob ストアが private 設定のため、/api/site/upload は private で保存している。private の URL は
 * ブラウザで直接開けないので、ここで中継する（画面側は siteAssetSrc() でこのルートを指す）。
 *
 * 渡された URL は isSiteAssetUrl で「Vercel Blob の site/ 配下」に限る。site/ 配下は公開サイトに出すための
 * ファイルだけなので、応募者の添付（forms/）や商品写真（entries/ 等）はこのルートからは取れない。
 *
 * 公開サイトから使うので誰でも読める（src/lib/public-paths.ts の PUBLIC_PATHS）。
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
    // ?w=640 のように幅を指定された画像は、その幅に縮めて WebP で返す（PDF などはそのまま）
    const width = Number(request.nextUrl.searchParams.get("w"));
    const type = result.blob.contentType || "";
    if (IMAGE_WIDTHS.includes(width) && type.startsWith("image/") && !type.includes("svg")) {
      const buf = Buffer.from(await new Response(result.stream).arrayBuffer());
      const out = await sharp(buf).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      return new NextResponse(new Uint8Array(out), {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=86400, s-maxage=604800",
        },
      });
    }

    // 保存名は毎回ランダムなので、同じ URL の中身は変わらない。長めにキャッシュしてよい
    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType || "application/octet-stream",
        "Content-Disposition": "inline",
        // 中身は変わらないので、CDN にも長めに置いてよい
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    });
  } catch (error) {
    console.error("Site asset fetch error:", error);
    return NextResponse.json({ success: false, message: "ファイルの取得に失敗しました" }, { status: 500 });
  }
}
