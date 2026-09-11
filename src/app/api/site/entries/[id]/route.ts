import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const MAX_SITE_PHOTOS = 3;

// 受賞商品の公開画面から、商品ごとの「サイトに公開」と「サイトに出す写真」を保存する。
// サイト管理（canManageSite）だけ。/site の layout は API を通らないので、ここで改めて確認する。
//   sitePublished: boolean
//   sitePhotoIds:  そのエントリーの EntryImage.id の配列（最大3、並び順どおり）。null / [] でメイン画像1枚に戻す
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = await getRoleFromRequest(request);
    if (!getPermissions(role).canManageSite) {
      return NextResponse.json(
        { success: false, message: "サイト管理の権限がありません" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const entryId = parseInt(id);
    const body = await request.json().catch(() => ({}));

    const entry = await prisma.entry.findUnique({
      where: { id: entryId },
      select: {
        id: true,
        productName: true,
        companyName: true,
        sitePublished: true,
        images: { select: { id: true } },
      },
    });
    if (!entry) {
      return NextResponse.json(
        { success: false, message: "エントリーが見つかりません" },
        { status: 404 }
      );
    }

    const data: Prisma.EntryUpdateInput = {};
    const changes: string[] = [];

    if ("sitePublished" in body) {
      if (typeof body.sitePublished !== "boolean") {
        return NextResponse.json(
          { success: false, message: "sitePublished は true / false で指定してください" },
          { status: 400 }
        );
      }
      data.sitePublished = body.sitePublished;
      if (body.sitePublished !== entry.sitePublished) {
        changes.push(body.sitePublished ? "サイトに公開" : "サイトで非公開");
      }
    }

    if ("sitePhotoIds" in body) {
      const raw = body.sitePhotoIds;
      if (raw === null || (Array.isArray(raw) && raw.length === 0)) {
        data.sitePhotoIds = Prisma.DbNull;
        changes.push("表示写真: 自動（メイン画像1枚）");
      } else {
        const ownIds = new Set(entry.images.map((img) => img.id));
        const ids = Array.isArray(raw) ? raw : [];
        const valid =
          ids.length > 0 &&
          ids.length <= MAX_SITE_PHOTOS &&
          ids.every((v: unknown) => Number.isInteger(v) && ownIds.has(v as number)) &&
          new Set(ids).size === ids.length;
        if (!valid) {
          return NextResponse.json(
            { success: false, message: `写真はこの商品の画像から最大${MAX_SITE_PHOTOS}枚まで選べます` },
            { status: 400 }
          );
        }
        data.sitePhotoIds = ids;
        changes.push(`表示写真: ${ids.length}枚`);
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, message: "変更する項目がありません" },
        { status: 400 }
      );
    }

    await prisma.entry.update({ where: { id: entryId }, data });

    if (changes.length > 0) {
      const user = await getUserFromRequest(request);
      await writeAuditLog({
        userId: user?.userId,
        userEmail: user?.email,
        action: "site",
        target: "entry",
        targetId: String(entryId),
        detail: `${entry.productName}（${entry.companyName}）: ${changes.join("、")}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Site entry update error:", error);
    return NextResponse.json(
      { success: false, message: "保存中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
