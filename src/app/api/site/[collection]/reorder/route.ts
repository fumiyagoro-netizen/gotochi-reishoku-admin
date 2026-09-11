import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnlessSiteManager, siteAuditLog } from "@/lib/site-api";
import { COLLECTIONS, delegateOf, isCollectionKind } from "@/lib/site-collections";

// 並べ替え。{ ids: [...] } の順に sortOrder を 0,1,2… と振り直す。
// 渡された行はすべて同じ並べ替えの単位（審査員なら同じ年度、パートナーなら同じ種別）であること
export async function POST(request: NextRequest, { params }: { params: Promise<{ collection: string }> }) {
  const denied = await denyUnlessSiteManager(request);
  if (denied) return denied;
  const { collection } = await params;
  if (!isCollectionKind(collection) || !COLLECTIONS[collection].sortScope) {
    return NextResponse.json({ success: false, message: "並べ替えできません" }, { status: 404 });
  }
  const def = COLLECTIONS[collection];

  try {
    const body = await request.json().catch(() => ({}));
    const ids: number[] = Array.isArray(body.ids) ? body.ids.map(Number) : [];
    if (ids.length === 0 || ids.some((id) => !Number.isInteger(id)) || new Set(ids).size !== ids.length) {
      return NextResponse.json({ success: false, message: "並び順が正しくありません" }, { status: 400 });
    }

    const rows = await delegateOf(prisma, def).findMany({ where: { id: { in: ids } } });
    const scopes = new Set(rows.map((r) => JSON.stringify(def.sortScope!(r))));
    if (rows.length !== ids.length || scopes.size !== 1) {
      return NextResponse.json({ success: false, message: "並べ替えの対象が正しくありません" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const model = delegateOf(tx, def);
      for (const [i, id] of ids.entries()) await model.update({ where: { id }, data: { sortOrder: i } });
    });
    await siteAuditLog(request, collection, ids.join(","), `${def.label}の並び順を変更`);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(`Site ${collection} reorder error:`, e);
    return NextResponse.json({ success: false, message: "並べ替え中にエラーが発生しました" }, { status: 500 });
  }
}
