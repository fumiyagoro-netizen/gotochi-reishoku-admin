import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import type { EntryPhoto } from "@/lib/entry-photos-shared";

// 商品写真の差し替え・追加・削除（/api/entries/[id]/images）のサーバー側の共通処理。
//
// 差し替えは同じ行の imageUrl を書き換えず、新しい行を作って古い行を消す。公開中の写真は
// /api/images/<id> を CDN に「1年・変わらない」としてキャッシュさせているので、同じ id のまま
// 中身を変えると公開サイトに古い写真が出続けるため。id が変わるので、サイトに出す写真の選択
// （Entry.sitePhotoIds）も新しい id に付け替える。
// Blob の元ファイルは消さない（取り違えたときに戻せるように。容量は小さい）。

/** 管理者（canEditEntry）でなければ 403 を返す */
export async function denyUnlessEntryEditor(request: NextRequest) {
  const role = await getRoleFromRequest(request);
  if (!getPermissions(role).canEditEntry) {
    return NextResponse.json({ success: false, message: "写真を変更する権限がありません" }, { status: 403 });
  }
  return null;
}

export async function loadEntryPhotos(entryId: number) {
  return prisma.entry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      productName: true,
      companyName: true,
      sitePhotoIds: true,
      images: { select: { id: true, imageType: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
    },
  });
}

/** 画面に返す並び（メインが先、あとは並び順どおり） */
export async function listEntryPhotos(entryId: number): Promise<EntryPhoto[]> {
  const images = await prisma.entryImage.findMany({
    where: { entryId },
    select: { id: true, imageUrl: true, imageType: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });
  return [...images]
    .sort((a, b) => Number(b.imageType === "main") - Number(a.imageType === "main"))
    .map(({ id, imageUrl, imageType }) => ({ id, imageUrl, imageType }));
}

function toIds(sitePhotoIds: unknown): number[] {
  return Array.isArray(sitePhotoIds) ? sitePhotoIds.filter((v): v is number => Number.isInteger(v)) : [];
}

/** サイトに出す写真の選択から oldId を除く（newId があれば同じ位置に入れる）。変わらなければ undefined */
export function swapSitePhotoId(
  sitePhotoIds: unknown,
  oldId: number,
  newId?: number,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  const ids = toIds(sitePhotoIds);
  if (!ids.includes(oldId)) return undefined;
  const next = ids.flatMap((id) => (id === oldId ? (newId ? [newId] : []) : [id]));
  return next.length > 0 ? next : Prisma.DbNull;
}
