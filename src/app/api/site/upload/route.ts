import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { denyUnlessSiteManager } from "@/lib/site-api";
import { SITE_UPLOAD_KINDS, SITE_UPLOAD_MAX_BYTES, type SiteUploadKind } from "@/lib/site-collections-shared";

// サイト管理の画像・PDF のアップロード。サイト管理（canManageSite）だけ。
// 審査員の写真・ロゴ・受賞者の声の写真・リーフレットはどれも公開サイトに出すものなので、
// フォームの画像ブロック（/api/forms/image）と同じく access:"public" で保存する（応募者の添付は private のまま）。
// 画像は種類ごとの大きさに縮めて WebP にする（透過は残る）。

const IMAGE_MAX_EDGE: Record<Exclude<SiteUploadKind, "leaflet">, number> = {
  judge: 800,
  partner: 800,
  voice: 1600,
};
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  const denied = await denyUnlessSiteManager(request);
  if (denied) return denied;

  try {
    const form = await request.formData();
    const kind = String(form.get("kind") ?? "") as SiteUploadKind;
    const file = form.get("file");
    if (!SITE_UPLOAD_KINDS.includes(kind)) {
      return NextResponse.json({ success: false, message: "保存先の種類が正しくありません" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "ファイルを選んでください" }, { status: 400 });
    }
    if (file.size > SITE_UPLOAD_MAX_BYTES) {
      return NextResponse.json({ success: false, message: "ファイルは4MBまでです" }, { status: 400 });
    }

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (kind === "leaflet") {
      if (file.type !== "application/pdf") {
        return NextResponse.json({ success: false, message: "リーフレットは PDF を選んでください" }, { status: 400 });
      }
      const blob = await put(`site/leaflet/${stamp}.pdf`, file, { access: "public", contentType: "application/pdf" });
      return NextResponse.json({ success: true, url: blob.url });
    }

    if (!IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, message: "画像（PNG / JPEG / WebP / GIF）を選んでください" }, { status: 400 });
    }
    const edge = IMAGE_MAX_EDGE[kind];
    const webp = await sharp(Buffer.from(await file.arrayBuffer()), { failOn: "none" })
      .rotate()
      .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const blob = await put(`site/${kind}/${stamp}.webp`, webp, { access: "public", contentType: "image/webp" });
    return NextResponse.json({ success: true, url: blob.url });
  } catch (error) {
    console.error("Site upload error:", error);
    return NextResponse.json({ success: false, message: "アップロードに失敗しました" }, { status: 500 });
  }
}
