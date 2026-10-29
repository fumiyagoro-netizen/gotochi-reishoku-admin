import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { denyUnlessEntryEditor, listEntryPhotos, loadEntryPhotos, swapSitePhotoId } from "@/lib/entry-photos";
import { photoLabel } from "@/lib/entry-photos-shared";

type Params = { params: Promise<{ id: string; imageId: string }> };

async function load(request: NextRequest, { params }: Params) {
  const denied = await denyUnlessEntryEditor(request);
  if (denied) return { denied };
  const { id, imageId } = await params;
  const entryId = parseInt(id);
  const entry = await loadEntryPhotos(entryId);
  const target = entry?.images.find((img) => img.id === parseInt(imageId));
  if (!entry || !target) {
    return {
      denied: NextResponse.json(
        { success: false, message: "写真が見つかりません。画面を読み込み直してください" },
        { status: 404 },
      ),
    };
  }
  return { entryId, entry, target };
}

async function log(request: NextRequest, entryId: number, entry: { productName: string; companyName: string }, detail: string) {
  const user = await getUserFromRequest(request);
  await writeAuditLog({
    userId: user?.userId,
    userEmail: user?.email,
    action: "update",
    target: "entry",
    targetId: String(entryId),
    detail: `${entry.productName}（${entry.companyName}）: ${detail}`,
  });
}

/**
 * サブ画像をメインビジュアルにする（管理者のみ）。body: { main: true }
 * 今のメインとは種類と並び順を入れ替える（一覧のサムネイル・PDF・公開サイトの既定はメインを使う）。
 */
export async function PATCH(request: NextRequest, ctx: Params) {
  const loaded = await load(request, ctx);
  if (loaded.denied) return loaded.denied;
  const { entryId, entry, target } = loaded;

  try {
    const body = await request.json().catch(() => ({}));
    if (body?.main !== true) {
      return NextResponse.json({ success: false, message: "変更する項目がありません" }, { status: 400 });
    }
    if (target.imageType === "main") {
      return NextResponse.json({ success: true, images: await listEntryPhotos(entryId) });
    }

    const currentMain = entry.images.find((img) => img.imageType === "main");
    await prisma.$transaction([
      ...(currentMain
        ? [prisma.entryImage.update({ where: { id: currentMain.id }, data: { imageType: "sub", sortOrder: target.sortOrder } })]
        : []),
      prisma.entryImage.update({
        where: { id: target.id },
        data: { imageType: "main", sortOrder: currentMain ? currentMain.sortOrder : target.sortOrder },
      }),
    ]);
    await log(request, entryId, entry, "サブ画像をメインビジュアルに変更");
    return NextResponse.json({ success: true, images: await listEntryPhotos(entryId) });
  } catch (error) {
    console.error("Entry photo update error:", error);
    return NextResponse.json({ success: false, message: "写真を変更できませんでした" }, { status: 500 });
  }
}

/**
 * 写真を1枚削除する（管理者のみ）。メインを消したら、残りの先頭のサブ画像をメインにする。
 * サイトに出す写真に選ばれていれば、その選択からも外す。
 */
export async function DELETE(request: NextRequest, ctx: Params) {
  const loaded = await load(request, ctx);
  if (loaded.denied) return loaded.denied;
  const { entryId, entry, target } = loaded;

  try {
    const promote =
      target.imageType === "main" ? entry.images.find((img) => img.id !== target.id && img.imageType === "sub") : undefined;
    const sitePhotoIds = swapSitePhotoId(entry.sitePhotoIds, target.id);

    await prisma.$transaction([
      prisma.entryImage.delete({ where: { id: target.id } }),
      ...(promote
        ? [prisma.entryImage.update({ where: { id: promote.id }, data: { imageType: "main", sortOrder: target.sortOrder } })]
        : []),
      ...(sitePhotoIds !== undefined ? [prisma.entry.update({ where: { id: entryId }, data: { sitePhotoIds } })] : []),
    ]);
    await log(
      request,
      entryId,
      entry,
      `商品写真を削除（${photoLabel(target.imageType)}）${promote ? "、サブ画像をメインビジュアルに変更" : ""}`,
    );
    return NextResponse.json({ success: true, images: await listEntryPhotos(entryId) });
  } catch (error) {
    console.error("Entry photo delete error:", error);
    return NextResponse.json({ success: false, message: "写真を削除できませんでした" }, { status: 500 });
  }
}
