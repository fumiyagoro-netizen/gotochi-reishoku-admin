import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { getRoleFromRequest } from "@/lib/role";
import { writeAuditLog } from "@/lib/audit";
import { sendReviewPassNotification } from "@/lib/email";

export async function POST(request: NextRequest) {
  const role = await getRoleFromRequest(request);
  if (role !== "admin") {
    return NextResponse.json({ success: false, message: "管理者のみ実行できます" }, { status: 403 });
  }

  const user = await getUserFromRequest(request);
  const body = await request.json();

  const { entryIds, reviewStage } = body as {
    entryIds: number[];
    reviewStage: string; // "1次審査" or "2次審査"
  };

  if (!entryIds?.length || !reviewStage) {
    return NextResponse.json({ success: false, message: "エントリーと審査段階を指定してください" }, { status: 400 });
  }

  const entries = await prisma.entry.findMany({
    where: { id: { in: entryIds } },
    include: { award: { select: { name: true } } },
  });

  let sent = 0;
  let failed = 0;

  for (const entry of entries) {
    const result = await sendReviewPassNotification({
      to: entry.email,
      contactName: `${entry.contactLastName} ${entry.contactFirstName}`,
      productName: entry.productName,
      companyName: entry.companyName,
      reviewStage,
      awardName: entry.award.name,
    });

    if (result) {
      sent++;
    } else {
      failed++;
    }
  }

  await writeAuditLog({
    userId: user?.userId,
    userEmail: user?.email,
    action: "notify",
    target: "entry",
    detail: `${reviewStage}通過通知を送信: ${sent}件成功, ${failed}件失敗 (対象IDs: ${entryIds.join(",")})`,
  });

  return NextResponse.json({
    success: true,
    sent,
    failed,
    total: entries.length,
  });
}
