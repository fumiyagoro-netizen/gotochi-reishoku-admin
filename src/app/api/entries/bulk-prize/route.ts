import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const VALID_PRIZES = ["最高金賞", "金賞", "銀賞", "銅賞", ""];

export async function POST(request: NextRequest) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);

    if (!perms.canSetPrize) {
      return NextResponse.json(
        { success: false, message: "受賞設定の権限がありません" },
        { status: 403 }
      );
    }

    const { entryIds, prizeLevel } = await request.json();

    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "エントリーを選択してください" },
        { status: 400 }
      );
    }

    if (!VALID_PRIZES.includes(prizeLevel)) {
      return NextResponse.json(
        { success: false, message: "無効な受賞レベルです" },
        { status: 400 }
      );
    }

    const result = await prisma.entry.updateMany({
      where: { id: { in: entryIds.map(Number) } },
      data: { prizeLevel },
    });

    // Audit log
    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "bulk_prize",
      target: "entry",
      targetId: entryIds.join(","),
      detail: prizeLevel
        ? `${result.count}件に「${prizeLevel}」を設定`
        : `${result.count}件の受賞を取り消し`,
    });

    return NextResponse.json({
      success: true,
      message: prizeLevel
        ? `${result.count}件に「${prizeLevel}」を設定しました`
        : `${result.count}件の受賞を取り消しました`,
      count: result.count,
    });
  } catch (error) {
    console.error("Bulk prize error:", error);
    return NextResponse.json(
      { success: false, message: "一括設定に失敗しました" },
      { status: 500 }
    );
  }
}
