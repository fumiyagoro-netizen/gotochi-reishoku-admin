import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { ITEM_ARRIVAL_LABELS, isItemArrivalStatus } from "@/lib/item-arrival-shared";

// Same shape as src/app/api/entries/bulk-review/route.ts, kept as its own
// route rather than a mode inside that one: bulk-review is gated on
// canSetPrize, this is gated on canSetItemArrival, and editor has the
// latter but not the former. One route per permission keeps each function
// body checking exactly one flag, so there is no risk of the two checks
// getting merged/reordered and accidentally granting editor reviewStatus
// access (or blocking editor from item arrival).
export async function POST(request: NextRequest) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);

    if (!perms.canSetItemArrival) {
      return NextResponse.json(
        { success: false, message: "商品到着設定の権限がありません" },
        { status: 403 }
      );
    }

    const { entryIds, itemArrivalStatus, action } = await request.json();
    // action: "add" (default), "remove", or "clear"

    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "エントリーを選択してください" },
        { status: 400 }
      );
    }

    if (action !== "clear" && !isItemArrivalStatus(itemArrivalStatus)) {
      return NextResponse.json(
        { success: false, message: "無効な商品到着ラベルです" },
        { status: 400 }
      );
    }

    const ids = entryIds.map(Number);

    if (action === "clear") {
      // Clear all item arrival labels
      const result = await prisma.entry.updateMany({
        where: { id: { in: ids } },
        data: { itemArrivalStatus: "" },
      });

      const user = await getUserFromRequest(request);
      await writeAuditLog({
        userId: user?.userId,
        userEmail: user?.email,
        action: "bulk_item_arrival",
        target: "entry",
        targetId: ids.join(","),
        detail: `${result.count}件の商品到着ラベルをすべて取り消し`,
      });

      return NextResponse.json({
        success: true,
        message: `${result.count}件の商品到着ラベルをすべて取り消しました`,
        count: result.count,
      });
    }

    // Add or remove a specific label
    const entries = await prisma.entry.findMany({
      where: { id: { in: ids } },
      select: { id: true, itemArrivalStatus: true },
    });

    let updatedCount = 0;
    for (const entry of entries) {
      const current = entry.itemArrivalStatus
        ? entry.itemArrivalStatus.split(",").filter(Boolean)
        : [];
      let updated: string[];

      if (action === "remove") {
        updated = current.filter((s) => s !== itemArrivalStatus);
      } else {
        // add (default)
        if (current.includes(itemArrivalStatus)) continue;
        updated = [...current, itemArrivalStatus];
      }

      await prisma.entry.update({
        where: { id: entry.id },
        data: { itemArrivalStatus: updated.join(",") },
      });
      updatedCount++;
    }

    const user = await getUserFromRequest(request);
    const label = ITEM_ARRIVAL_LABELS[itemArrivalStatus as keyof typeof ITEM_ARRIVAL_LABELS] || itemArrivalStatus;
    const actionLabel = action === "remove"
      ? `${updatedCount}件から「${label}」を削除`
      : `${updatedCount}件に「${label}」を追加`;

    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "bulk_item_arrival",
      target: "entry",
      targetId: ids.join(","),
      detail: actionLabel,
    });

    return NextResponse.json({
      success: true,
      message: action === "remove"
        ? `${updatedCount}件から「${label}」を削除しました`
        : `${updatedCount}件に「${label}」を追加しました`,
      count: updatedCount,
    });
  } catch (error) {
    console.error("Bulk item arrival error:", error);
    return NextResponse.json(
      { success: false, message: "一括設定に失敗しました" },
      { status: 500 }
    );
  }
}
