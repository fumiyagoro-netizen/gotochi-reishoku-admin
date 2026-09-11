import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { isFormImageUrl } from "@/lib/form-shared";

/**
 * フォームの画像ブロックの画像を配信する。
 *
 * Blob ストアが private 設定のため、/api/forms/image は private で保存している。private の URL は
 * ブラウザで直接開けないので、ここで中継する（画面側は formImageSrc() でこのルートを指す）。
 *
 * 公開フォーム（/f/<slug>）はログインなしで開かれるので、このルートも PUBLIC_PATHS に入れて
 * 誰でも読めるようにしている。その代わり、渡された URL は isFormImageUrl で
 * 「Vercel Blob の forms/images/ 配下」に限る。forms/images/ はフォーム上に掲示するための画像だけで、
 * 回答者の添付（forms/ 直下、事務局だけが /api/forms/attachment で開く）や商品写真はここからは取れない。
 *
 * 画像はこのアプリと同じドメインから返すことになるので、SVG に仕込まれたスクリプトなどが
 * 動かないよう、nosniff と sandbox の CSP を付ける（<img> で表示する分には影響しない）。
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("u") || "";
  if (!isFormImageUrl(url)) {
    return NextResponse.json({ success: false, message: "見つかりません" }, { status: 404 });
  }

  try {
    const result = await get(url, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json({ success: false, message: "見つかりません" }, { status: 404 });
    }
    const contentType = result.blob.contentType || "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ success: false, message: "見つかりません" }, { status: 404 });
    }
    // 保存名は毎回ランダムなので、同じ URL の中身は変わらない。長めにキャッシュしてよい
    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (error) {
    console.error("Form image fetch error:", error);
    return NextResponse.json({ success: false, message: "画像の取得に失敗しました" }, { status: 500 });
  }
}
