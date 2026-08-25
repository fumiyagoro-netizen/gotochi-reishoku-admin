import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAwardId } from "@/lib/award";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { jstDateStringToStartOfDayUtc, jstDateStringToEndOfDayUtc } from "@/lib/award-dates";
import { calcInvoiceTotals, DEFAULT_UNIT } from "@/lib/invoice-shared";
import { nextInvoiceNo, isUniqueConstraintError } from "@/lib/invoice";

const PAGE_SIZE = 20;
const MAX_RETRY = 5;

// GET: list invoices with optional year (via the linked Entry's Award) /
// text search, paginated. Mirrors the shape of GET /api/prospects.
export async function GET(request: NextRequest) {
  const role = await getRoleFromRequest(request);
  const perms = getPermissions(role);
  if (!perms.canManageInvoices) {
    return NextResponse.json({ success: false, message: "閲覧権限がありません" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const q = (params.get("q") || "").trim();
  const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
  const awardId = await resolveAwardId(params.get("year") || undefined);

  try {
    const where = {
      AND: [
        awardId ? { entry: { awardId } } : {},
        q
          ? {
              OR: [
                { invoiceNo: { contains: q } },
                { recipientName: { contains: q } },
              ],
            }
          : {},
      ],
    };

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { issueDate: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { entry: { select: { companyName: true, award: { select: { year: true } } } } },
      }),
      prisma.invoice.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      invoices,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  } catch (error) {
    console.error("Invoices GET error:", error);
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

// POST: create a new invoice. All amounts (line amount / subtotal / tax /
// total) are computed here from quantity×unitPrice — a client-sent total is
// never trusted (this is a money document; see the completion instructions
// this feature was built against).
export async function POST(request: NextRequest) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canManageInvoices) {
      return NextResponse.json({ success: false, message: "作成権限がありません" }, { status: 403 });
    }

    const body = await request.json();

    const entryId = parseInt(body.entryId, 10);
    if (!Number.isFinite(entryId)) {
      return NextResponse.json({ success: false, message: "対象エントリーを選択してください" }, { status: 400 });
    }
    const entry = await prisma.entry.findUnique({ where: { id: entryId } });
    if (!entry) {
      return NextResponse.json({ success: false, message: "対象エントリーが見つかりません" }, { status: 404 });
    }

    const recipientName = String(body.recipientName ?? "").trim();
    if (!recipientName) {
      return NextResponse.json({ success: false, message: "宛名は必須です" }, { status: 400 });
    }

    const issueDate = jstDateStringToStartOfDayUtc(body.issueDate);
    if (!issueDate) {
      return NextResponse.json({ success: false, message: "発行日が不正です" }, { status: 400 });
    }
    const dueDate = jstDateStringToEndOfDayUtc(body.dueDate);
    if (!dueDate) {
      return NextResponse.json({ success: false, message: "支払期限が不正です" }, { status: 400 });
    }

    const lines = parseLines(body.lines);
    if (!lines) {
      return NextResponse.json(
        { success: false, message: "明細を1件以上、正しい内容で入力してください" },
        { status: 400 }
      );
    }

    const { subtotal, taxAmount, totalAmount } = calcInvoiceTotals(lines);
    const notes = String(body.notes ?? "");

    const user = await getUserFromRequest(request);
    // Snapshot the creator's display name at creation time (User.name,
    // falling back to email) — same pattern as EntryComment.authorName in
    // src/app/api/entries/[id]/comments/route.ts — so the invoice still
    // shows who created it even after the user account is later deleted.
    let createdByName = user?.email ?? "";
    if (user?.userId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { name: true, email: true },
      });
      createdByName = dbUser?.name || dbUser?.email || createdByName;
    }
    const requestedInvoiceNo = String(body.invoiceNo ?? "").trim();

    let created = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
      const invoiceNo = requestedInvoiceNo || (await nextInvoiceNo(issueDate));
      try {
        created = await prisma.invoice.create({
          data: {
            invoiceNo,
            entryId,
            recipientName,
            issueDate,
            dueDate,
            notes,
            subtotal,
            taxAmount,
            totalAmount,
            createdByUserId: user?.userId,
            createdByName,
            lines: {
              create: lines.map((l, i) => ({
                sortOrder: i,
                date: l.date,
                name: l.name,
                quantity: l.quantity,
                unit: l.unit,
                unitPrice: l.unitPrice,
                amount: l.quantity * l.unitPrice,
              })),
            },
          },
          include: { lines: { orderBy: { sortOrder: "asc" } } },
        });
        break;
      } catch (e) {
        lastError = e;
        // 手動で書類番号を指定していた場合、自動採番のリトライでは重複は
        // 解消しない（同じ値を要求し続けることになる）ので即座にエラーを返す。
        if (requestedInvoiceNo || !isUniqueConstraintError(e)) throw e;
      }
    }

    if (!created) {
      console.error("Create invoice: exhausted invoiceNo retries", lastError);
      return NextResponse.json(
        { success: false, message: "書類番号の採番に失敗しました。もう一度お試しください" },
        { status: 500 }
      );
    }

    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "create",
      target: "invoice",
      targetId: String(created.id),
      detail: `請求書作成: ${created.invoiceNo} 宛先: ${created.recipientName} 金額: ¥${created.totalAmount}`,
    });

    return NextResponse.json({ success: true, invoice: created });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { success: false, message: "その書類番号はすでに使用されています" },
        { status: 409 }
      );
    }
    console.error("Create invoice error:", error);
    return NextResponse.json({ success: false, message: "請求書の作成に失敗しました" }, { status: 500 });
  }
}
