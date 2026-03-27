import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const VALID_STATUSES = ["first_passed", "second_passed", ""];

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

    const { entryIds, reviewStatus } = await request.json();

    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "エントリーを選択してください" },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(reviewStatus)) {
      return NextResponse.json(
        { success: false, message: "無効な審査状況です" },
        { status: 400 }
      );
    }

    const LABELS: Record<string, string> = {
      first_passed: "1次審査通過",
      second_passed: "2次審査通過",
    };

    const result = await prisma.entry.updateMany({
      where: { id: { in: entryIds.map(Number) } },
      data: { reviewStatus },
    });

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "bulk_review",
      target: "entry",
      targetId: entryIds.join(","),
      detail: reviewStatus
        ? `${result.count}件を「${LABELS[reviewStatus]}」に設定`
        : `${result.count}件の審査状況を取り消し`,
    });

    return NextResponse.json({
      success: true,
      message: reviewStatus
        ? `${result.count}件を「${LABELS[reviewStatus]}」に設定しました`
        : `${result.count}件の審査状況を取り消しました`,
      count: result.count,
    });
  } catch (error) {
    console.error("Bulk review error:", error);
    return NextResponse.json(
      { success: false, message: "一括設定に失敗しました" },
      { status: 500 }
    );
  }
}
