import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnlessSiteManager, siteAuditLog } from "@/lib/site-api";
import { COLLECTIONS, delegateOf, isCollectionKind } from "@/lib/site-collections";

// サイト管理の一覧（news / judges / voices / partners）に1件作る。ルールは src/lib/site-collections.ts
export async function POST(request: NextRequest, { params }: { params: Promise<{ collection: string }> }) {
  const denied = await denyUnlessSiteManager(request);
  if (denied) return denied;
  const { collection } = await params;
  if (!isCollectionKind(collection)) {
    return NextResponse.json({ success: false, message: "見つかりません" }, { status: 404 });
  }
  const def = COLLECTIONS[collection];

  try {
    const body = await request.json().catch(() => ({}));
    const { data, error } = await def.parse(body, true);
    if (error || !data) return NextResponse.json({ success: false, message: error }, { status: 400 });

    const model = delegateOf(prisma, def);
    if (def.sortScope) {
      const max = await model.aggregate({ where: def.sortScope({ id: 0, ...data }), _max: { sortOrder: true } });
      data.sortOrder = (max._max.sortOrder ?? -1) + 1;
    }
    const row = await model.create({ data });
    await siteAuditLog(request, collection, row.id, `${def.label}${def.describe(row)}を作成`);
    return NextResponse.json({ success: true, id: row.id });
  } catch (e) {
    console.error(`Site ${collection} create error:`, e);
    return NextResponse.json({ success: false, message: "保存中にエラーが発生しました" }, { status: 500 });
  }
}
