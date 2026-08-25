import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const EDITABLE_FIELDS = ["name", "unitPrice", "sortOrder", "isActive"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canManageInvoices) {
      return NextResponse.json({ success: false, message: "編集権限がありません" }, { status: 403 });
    }

    const { id } = await params;
    const itemId = parseInt(id);
    const body = await request.json();

    const item = await prisma.invoiceItem.findUnique({ where: { id: itemId } });
    if (!item) {
      return NextResponse.json({ success: false, message: "対象のデータが見つかりません" }, { status: 404 });
    }

    if ("name" in body && !String(body.name ?? "").trim()) {
      return NextResponse.json({ success: false, message: "品名は必須です" }, { status: 400 });
    }
    if ("unitPrice" in body && !Number.isFinite(Number(body.unitPrice))) {
      return NextResponse.json({ success: false, message: "単価が不正です" }, { status: 400 });
    }

    const data: Record<string, string | number | boolean> = {};
    const changes: string[] = [];
    for (const key of EDITABLE_FIELDS) {
      if (key in body) {
        const raw = body[key];
        const value =
          key === "unitPrice" || key === "sortOrder"
            ? Math.trunc(Number(raw))
            : key === "isActive"
              ? Boolean(raw)
              : String(raw).trim();
        const oldVal = (item as unknown as Record<string, unknown>)[key];
        if (oldVal !== value) changes.push(`${key}: "${oldVal}" → "${value}"`);
        data[key] = value;
      }
    }

    const updated = await prisma.invoiceItem.update({ where: { id: itemId }, data });

    const user = await getUserFromRequest(request);
    if (changes.length > 0) {
      await writeAuditLog({
        userId: user?.userId,
        userEmail: user?.email,
        action: "update",
        target: "invoice_item",
        targetId: String(itemId),
        detail: `${item.name}: ${changes.join(", ")}`,
      });
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    console.error("Update invoice item error:", error);
    return NextResponse.json({ success: false, message: "更新に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canManageInvoices) {
      return NextResponse.json({ success: false, message: "削除権限がありません" }, { status: 403 });
    }

    const { id } = await params;
    const itemId = parseInt(id);

    const item = await prisma.invoiceItem.findUnique({ where: { id: itemId } });
    if (!item) {
      return NextResponse.json({ success: false, message: "対象のデータが見つかりません" }, { status: 404 });
    }

    // InvoiceLine は InvoiceItem への外部キーを持たず、作成時に値をコピーして
    // 保持している（prisma/schema.prisma の InvoiceLine コメント参照）ため、
    // マスタ行を物理削除しても既存の請求書内容には一切影響しない。
    await prisma.invoiceItem.delete({ where: { id: itemId } });

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "delete",
      target: "invoice_item",
      targetId: String(itemId),
      detail: `請求項目マスタ削除: ${item.name}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete invoice item error:", error);
    return NextResponse.json({ success: false, message: "削除中にエラーが発生しました" }, { status: 500 });
  }
}
