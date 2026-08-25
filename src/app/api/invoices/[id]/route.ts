import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { jstDateStringToStartOfDayUtc, jstDateStringToEndOfDayUtc } from "@/lib/award-dates";
import { calcInvoiceTotals, DEFAULT_UNIT } from "@/lib/invoice-shared";
import { isUniqueConstraintError } from "@/lib/invoice";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = await getRoleFromRequest(request);
  const perms = getPermissions(role);
  if (!perms.canManageInvoices) {
    return NextResponse.json({ success: false, message: "閲覧権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const invoiceId = parseInt(id);

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lines: { orderBy: { sortOrder: "asc" } },
        entry: {
          select: {
            id: true,
            companyName: true,
            contactLastName: true,
            contactFirstName: true,
            email: true,
            award: { select: { year: true } },
          },
        },
      },
    });
    if (!invoice) {
      return NextResponse.json({ success: false, message: "対象の請求書が見つかりません" }, { status: 404 });
    }
    return NextResponse.json({ success: true, invoice });
  } catch (error) {
    console.error("Invoice GET error:", error);
    return NextResponse.json({ success: false, message: "請求書の取得に失敗しました" }, { status: 500 });
  }
}

interface LineInput {
  date?: string;
  name?: unknown;
  quantity?: unknown;
  unit?: unknown;
  unitPrice?: unknown;
}

function parseLines(raw: unknown): { name: string; quantity: number; unit: string; unitPrice: number; date: Date }[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const result: { name: string; quantity: number; unit: string; unitPrice: number; date: Date }[] = [];
  for (const l of raw as LineInput[]) {
    const name = String(l.name ?? "").trim();
    const quantity = Math.trunc(Number(l.quantity));
    const unitPrice = Math.trunc(Number(l.unitPrice));
    const unit = String(l.unit ?? "").trim() || DEFAULT_UNIT;
    const date = jstDateStringToStartOfDayUtc(typeof l.date === "string" ? l.date : undefined);
    if (!name || !Number.isFinite(quantity) || quantity < 1 || !Number.isFinite(unitPrice) || !date) {
      return null;
    }
    result.push({ name, quantity, unit, unitPrice, date });
  }
  return result;
}

// PATCH: update an invoice's header fields and/or fully replace its line
// items. entryId is intentionally not editable here — which entry an
// invoice belongs to is fixed at creation (src/app/api/invoices/route.ts
// POST), same as Prospect.awardId not being editable after create. Amounts
// are always recomputed server-side from the submitted lines (or left as
// they were if `lines` isn't included in the request), never trusted from
// the client.
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
    const invoiceId = parseInt(id);
    const body = await request.json();

    const existing = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "対象の請求書が見つかりません" }, { status: 404 });
    }

    const data: {
      invoiceNo?: string;
      recipientName?: string;
      issueDate?: Date;
      dueDate?: Date;
      notes?: string;
      subtotal?: number;
      taxAmount?: number;
      totalAmount?: number;
    } = {};
    const changes: string[] = [];

    if ("invoiceNo" in body) {
      const invoiceNo = String(body.invoiceNo ?? "").trim();
      if (!invoiceNo) {
        return NextResponse.json({ success: false, message: "書類番号は必須です" }, { status: 400 });
      }
      if (invoiceNo !== existing.invoiceNo) changes.push(`書類番号: "${existing.invoiceNo}" → "${invoiceNo}"`);
      data.invoiceNo = invoiceNo;
    }
    if ("recipientName" in body) {
      const recipientName = String(body.recipientName ?? "").trim();
      if (!recipientName) {
        return NextResponse.json({ success: false, message: "宛名は必須です" }, { status: 400 });
      }
      if (recipientName !== existing.recipientName) changes.push("宛名を変更");
      data.recipientName = recipientName;
    }
    if ("issueDate" in body) {
      const issueDate = jstDateStringToStartOfDayUtc(body.issueDate);
      if (!issueDate) {
        return NextResponse.json({ success: false, message: "発行日が不正です" }, { status: 400 });
      }
      data.issueDate = issueDate;
    }
    if ("dueDate" in body) {
      const dueDate = jstDateStringToEndOfDayUtc(body.dueDate);
      if (!dueDate) {
        return NextResponse.json({ success: false, message: "支払期限が不正です" }, { status: 400 });
      }
      data.dueDate = dueDate;
    }
    if ("notes" in body) {
      data.notes = String(body.notes ?? "");
    }

    let newLines: ReturnType<typeof parseLines> = null;
    if ("lines" in body) {
      newLines = parseLines(body.lines);
      if (!newLines) {
        return NextResponse.json(
          { success: false, message: "明細を1件以上、正しい内容で入力してください" },
          { status: 400 }
        );
      }
      const totals = calcInvoiceTotals(newLines);
      data.subtotal = totals.subtotal;
      data.taxAmount = totals.taxAmount;
      data.totalAmount = totals.totalAmount;
      changes.push("明細を更新");
    }

    const linesToCreate = newLines;
    const updated = await prisma.$transaction(async (tx) => {
      if (linesToCreate) {
        await tx.invoiceLine.deleteMany({ where: { invoiceId } });
      }
      return tx.invoice.update({
        where: { id: invoiceId },
        data: {
          ...data,
          ...(linesToCreate
            ? {
                lines: {
                  create: linesToCreate.map((l, i) => ({
                    sortOrder: i,
                    date: l.date,
                    name: l.name,
                    quantity: l.quantity,
                    unit: l.unit,
                    unitPrice: l.unitPrice,
                    amount: l.quantity * l.unitPrice,
                  })),
                },
              }
            : {}),
        },
        include: { lines: { orderBy: { sortOrder: "asc" } } },
      });
    });

    const user = await getUserFromRequest(request);
    if (changes.length > 0) {
      await writeAuditLog({
        userId: user?.userId,
        userEmail: user?.email,
        action: "update",
        target: "invoice",
        targetId: String(invoiceId),
        detail: `${existing.invoiceNo}: ${changes.join(", ")}`,
      });
    }

    return NextResponse.json({ success: true, invoice: updated });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { success: false, message: "その書類番号はすでに使用されています" },
        { status: 409 }
      );
    }
    console.error("Update invoice error:", error);
    return NextResponse.json({ success: false, message: "更新に失敗しました" }, { status: 500 });
  }
}

// DELETE: gated on canManageInvoices alone (not additionally canDelete) —
// same reasoning as Prospect deletion (src/app/api/prospects/[id]/route.ts):
// both roles that carry canManageInvoices (admin/representative) are
// already trusted with every other invoice operation, and representative's
// canDelete is false, which would otherwise leave them unable to remove an
// invoice created by mistake before it's ever sent. This intentionally
// still allows deleting an invoice that HAS already been emailed (see
// src/app/api/invoices/[id]/send/route.ts) — the recipient already has the
// PDF/EmailLog record of that send regardless, and blocking deletion here
// wouldn't undo it, so there's no safety benefit to adding that restriction.
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
    const invoiceId = parseInt(id);

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      return NextResponse.json({ success: false, message: "対象の請求書が見つかりません" }, { status: 404 });
    }

    await prisma.invoice.delete({ where: { id: invoiceId } });

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "delete",
      target: "invoice",
      targetId: String(invoiceId),
      detail: `請求書削除: ${invoice.invoiceNo} 宛先: ${invoice.recipientName}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete invoice error:", error);
    return NextResponse.json({ success: false, message: "削除中にエラーが発生しました" }, { status: 500 });
  }
}
