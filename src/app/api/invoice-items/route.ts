import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

// GET: list all 請求項目マスタ rows, including inactive ones (the master
// management screen shows both; the invoice line-item picker filters to
// isActive itself). Always ordered by sortOrder so the management screen's
// manual ordering is reflected everywhere it's read from.
export async function GET(request: NextRequest) {
  const role = await getRoleFromRequest(request);
  const perms = getPermissions(role);
  if (!perms.canManageInvoices) {
    return NextResponse.json({ success: false, message: "閲覧権限がありません" }, { status: 403 });
  }

  try {
    const items = await prisma.invoiceItem.findMany({ orderBy: { sortOrder: "asc" } });
    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("Invoice items GET error:", error);
    return NextResponse.json(
      { success: false, message: "請求項目マスタの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: create a new master item. New rows sort after every existing row
// by default (max(sortOrder) + 1), so a newly added item doesn't jump into
// the middle of the manually-ordered list.
export async function POST(request: NextRequest) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canManageInvoices) {
      return NextResponse.json({ success: false, message: "編集権限がありません" }, { status: 403 });
    }

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ success: false, message: "品名は必須です" }, { status: 400 });
    }
    const unitPrice = Math.trunc(Number(body.unitPrice));
    if (!Number.isFinite(unitPrice)) {
      return NextResponse.json({ success: false, message: "単価が不正です" }, { status: 400 });
    }

    const last = await prisma.invoiceItem.findFirst({ orderBy: { sortOrder: "desc" } });
    const sortOrder = (last?.sortOrder ?? -1) + 1;

    const item = await prisma.invoiceItem.create({
      data: { name, unitPrice, sortOrder, isActive: body.isActive !== false },
    });

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "create",
      target: "invoice_item",
      targetId: String(item.id),
      detail: `請求項目マスタ作成: ${item.name}（¥${item.unitPrice}）`,
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("Create invoice item error:", error);
    return NextResponse.json(
      { success: false, message: "請求項目マスタの作成に失敗しました" },
      { status: 500 }
    );
  }
}
