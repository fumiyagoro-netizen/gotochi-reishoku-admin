import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import sharp from "@/lib/sharp";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { denyUnlessEntryEditor, listEntryPhotos, loadEntryPhotos, swapSitePhotoId } from "@/lib/entry-photos";
import { ENTRY_PHOTO_MAX_BYTES, MAX_ENTRY_PHOTOS, photoLabel } from "@/lib/entry-photos-shared";

const FORMAT_EXT: Record<string, { ext: string; contentType: string }> = {
  jpeg: { ext: "jpg", contentType: "image/jpeg" },
  png: { ext: "png", contentType: "image/png" },
  webp: { ext: "webp", contentType: "image/webp" },
};

/**
 * 商品写真を1枚アップロードする（管理者のみ）。
 *   file:      画像（JPEG / PNG / WebP、4MB まで）
 *   replaceId: 差し替える写真の id。無ければ追加（メインが無ければメイン、あればサブの最後）
 * 元の画質のまま保存する（ダウンロードして報道向けに使うことがあるため縮めない）。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await denyUnlessEntryEditor(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const entryId = parseInt(id);
    const entry = await loadEntryPhotos(entryId);
    if (!entry) {
      return NextResponse.json({ success: false, message: "エントリーが見つかりません" }, { status: 404 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const replaceRaw = form.get("replaceId");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "写真を選んでください" }, { status: 400 });
    }
    if (file.size > ENTRY_PHOTO_MAX_BYTES) {
      return NextResponse.json({ success: false, message: "写真は4MBまでです" }, { status: 400 });
    }

    const target = replaceRaw ? entry.images.find((img) => img.id === Number(replaceRaw)) : undefined;
    if (replaceRaw && !target) {
      return NextResponse.json({ success: false, message: "差し替える写真が見つかりません。画面を読み込み直してください" }, { status: 404 });
    }
    if (!target && entry.images.length >= MAX_ENTRY_PHOTOS) {
      return NextResponse.json({ success: false, message: `写真は${MAX_ENTRY_PHOTOS}枚までです` }, { status: 400 });
    }

    // 名乗っている種類ではなく中身で判断する（SVG は src/lib/sharp.ts で読み込みを止めてある）
    const buffer = Buffer.from(await file.arrayBuffer());
    const format = await sharp(buffer)
      .metadata()
      .then((m) => m.format)
      .catch(() => undefined);
    const kind = format ? FORMAT_EXT[format] : undefined;
    if (!kind) {
      return NextResponse.json(
        { success: false, message: "JPEG・PNG・WebP の写真を選んでください。iPhone の写真（HEIC）は JPEG に書き出してから選んでください" },
        { status: 400 },
      );
    }

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const blob = await put(`entries/${stamp}.${kind.ext}`, buffer, { access: "private", contentType: kind.contentType });

    let detail: string;
    if (target) {
      const sitePhotoIds = entry.sitePhotoIds;
      await prisma.$transaction(async (tx) => {
        const created = await tx.entryImage.create({
          data: { entryId, imageUrl: blob.url, imageType: target.imageType, sortOrder: target.sortOrder },
        });
        await tx.entryImage.delete({ where: { id: target.id } });
        const next = swapSitePhotoId(sitePhotoIds, target.id, created.id);
        if (next !== undefined) await tx.entry.update({ where: { id: entryId }, data: { sitePhotoIds: next } });
      });
      detail = `商品写真を差し替え（${photoLabel(target.imageType)}）`;
    } else {
      const hasMain = entry.images.some((img) => img.imageType === "main");
      const orders = entry.images.map((img) => img.sortOrder);
      await prisma.entryImage.create({
        data: {
          entryId,
          imageUrl: blob.url,
          imageType: hasMain ? "sub" : "main",
          // メインは先頭、サブは最後に足す
          sortOrder: orders.length === 0 ? 0 : hasMain ? Math.max(...orders) + 1 : Math.min(...orders) - 1,
        },
      });
      detail = `商品写真を追加（${photoLabel(hasMain ? "sub" : "main")}）`;
    }

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "update",
      target: "entry",
      targetId: String(entryId),
      detail: `${entry.productName}（${entry.companyName}）: ${detail}`,
    });

    return NextResponse.json({ success: true, images: await listEntryPhotos(entryId) });
  } catch (error) {
    console.error("Entry photo upload error:", error);
    return NextResponse.json({ success: false, message: "写真をアップロードできませんでした" }, { status: 500 });
  }
}
