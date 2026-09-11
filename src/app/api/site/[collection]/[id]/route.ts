import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnlessSiteManager, deleteSiteAssets, siteAuditLog } from "@/lib/site-api";
import { COLLECTIONS, delegateOf, isCollectionKind } from "@/lib/site-collections";

type Ctx = { params: Promise<{ collection: string; id: string }> };

async function load(ctx: Ctx) {
  const { collection, id } = await ctx.params;
  if (!isCollectionKind(collection)) return null;
  const def = COLLECTIONS[collection];
  const model = delegateOf(prisma, def);
  const row = await model.findUnique({ where: { id: parseInt(id) } });
  return row ? { collection, def, model, row } : null;
}

// サイト管理の一覧の1件を更新する。差し替えで使わなくなった画像は消す
export async function PUT(request: NextRequest, ctx: Ctx) {
  const denied = await denyUnlessSiteManager(request);
  if (denied) return denied;
  try {
    const found = await load(ctx);
    if (!found) return NextResponse.json({ success: false, message: "見つかりません" }, { status: 404 });
    const { collection, def, model, row } = found;

    const body = await request.json().catch(() => ({}));
    const { data, error } = await def.parse(body, false);
    if (error || !data) return NextResponse.json({ success: false, message: error }, { status: 400 });

    const updated = await model.update({ where: { id: row.id }, data });
    const kept = new Set(def.assetUrls(updated));
    await deleteSiteAssets(def.assetUrls(row).filter((u) => !kept.has(u)));
    await siteAuditLog(request, collection, row.id, `${def.label}${def.describe(updated)}を更新`);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Site collection update error:", e);
    return NextResponse.json({ success: false, message: "保存中にエラーが発生しました" }, { status: 500 });
  }
}

// 1件を削除する（元に戻せない）。行が持っていた画像も消す
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const denied = await denyUnlessSiteManager(request);
  if (denied) return denied;
  try {
    const found = await load(ctx);
    if (!found) return NextResponse.json({ success: false, message: "見つかりません" }, { status: 404 });
    const { collection, def, model, row } = found;

    await model.delete({ where: { id: row.id } });
    await deleteSiteAssets(def.assetUrls(row));
    await siteAuditLog(request, collection, row.id, `${def.label}${def.describe(row)}を削除`);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Site collection delete error:", e);
    return NextResponse.json({ success: false, message: "削除中にエラーが発生しました" }, { status: 500 });
  }
}
