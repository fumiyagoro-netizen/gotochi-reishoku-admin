import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

// 請求状況を手動で「請求済み」にする／その印を外す（Entry.invoiceMarkedAt — src/lib/invoice-status-shared.ts）。
// 詳細画面の1件と、一覧の一括設定の両方からこの1本を呼ぶ。外すのは手動の印だけで、
// 請求書を送ったことによる「請求済み」は変わらない。
export async function POST(request: NextRequest) {
  try {
    const perms = getPermissions(await getRoleFromRequest(request));
    if (!perms.canSeeInvoiceStatus) {
      return NextResponse.json({ success: false, message: "請求状況を変更する権限がありません" }, { status: 403 });
    }

    const { entryIds, marked } = await request.json();
    if (!Array.isArray(entryIds) || entryIds.length === 0 || typeof marked !== "boolean") {
      return NextResponse.json({ success: false, message: "エントリーを選択してください" }, { status: 400 });
    }
    const ids = entryIds.map(Number).filter(Number.isInteger);

    // 付けるときは印の無いものだけ（付けた日時を上書きしない）、外すときは印のあるものだけ
    const result = await prisma.entry.updateMany({
      where: { id: { in: ids }, invoiceMarkedAt: marked ? null : { not: null } },
      data: { invoiceMarkedAt: marked ? new Date() : null },
    });

    const detail = marked
      ? `${result.count}件を請求済みに`
      : `${result.count}件の手動の請求済みを取り消し`;
    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "invoice_mark",
      target: "entry",
      targetId: ids.join(","),
      detail,
    });

    return NextResponse.json({ success: true, message: `${detail}しました`, count: result.count });
  } catch (error) {
    console.error("Invoice mark error:", error);
    return NextResponse.json({ success: false, message: "請求状況の変更に失敗しました" }, { status: 500 });
  }
}
