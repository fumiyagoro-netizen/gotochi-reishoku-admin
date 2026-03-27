import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const VALID_STATUSES = ["first_passed", "second_passed", ""];
const LABELS: Record<string, string> = {
  first_passed: "1次審査通過",
  second_passed: "2次審査通過",
};

export async function POST(request: NextRequest) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);

    if (!perms.canSetPrize) {
      return NextResponse.json(
        { success: false, message: "審査設定の権限がありません" },
        { status: 403 }
      );
    }

    const { entryIds, reviewStatus, action } = await request.json();
    // action: "add" (default), "remove", or "clear"

    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "エントリーを選択してください" },
        { status: 400 }
      );
    }

    if (action !== "clear" && !VALID_STATUSES.includes(reviewStatus)) {
      return NextResponse.json(
        { success: false, message: "無効な審査状況です" },
        { status: 400 }
      );
    }

    const ids = entryIds.map(Number);

    if (action === "clear") {
      // Clear all review statuses
      const result = await prisma.entry.updateMany({
        where: { id: { in: ids } },
        data: { reviewStatus: "" },
      });

      const user = await getUserFromRequest(request);
      await writeAuditLog({
        userId: user?.userId,
        userEmail: user?.email,
        action: "bulk_review",
        target: "entry",
        targetId: ids.join(","),
        detail: `${result.count}件の審査状況をすべて取り消し`,
      });

      return NextResponse.json({
        success: true,
        message: `${result.count}件の審査状況をすべて取り消しました`,
        count: result.count,
      });
    }

    // Add or remove a specific status
    const entries = await prisma.entry.findMany({
      where: { id: { in: ids } },
      select: { id: true, reviewStatus: true },
    });

    let updatedCount = 0;
    for (const entry of entries) {
      const current = entry.reviewStatus ? entry.reviewStatus.split(",").filter(Boolean) : [];
      let updated: string[];

      if (action === "remove") {
        updated = current.filter((s) => s !== reviewStatus);
      } else {
        // add (default)
        if (current.includes(reviewStatus)) continue;
        updated = [...current, reviewStatus];
      }

      await prisma.entry.update({
        where: { id: entry.id },
        data: { reviewStatus: updated.join(",") },
      });
      updatedCount++;
    }

    const user = await getUserFromRequest(request);
    const label = LABELS[reviewStatus] || reviewStatus;
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "bulk_review",
      target: "entry",
      targetId: ids.join(","),
      detail: action === "remove"
        ? `${updatedCount}件から「${label}」を削除`
        : `${updatedCount}件に「${label}」を追加`,
    });

    return NextResponse.json({
      success: true,
      message: action === "remove"
        ? `${updatedCount}件から「${label}」を削除しました`
        : `${updatedCount}件に「${label}」を追加しました`,
      count: updatedCount,
    });
  } catch (error) {
    console.error("Bulk review error:", error);
    return NextResponse.json(
      { success: false, message: "一括設定に失敗しました" },
      { status: 500 }
    );
  }
}
