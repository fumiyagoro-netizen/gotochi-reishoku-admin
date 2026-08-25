/**
 * Server-only invoice helpers (Prisma access). Pure helpers that don't
 * touch the DB live in src/lib/invoice-shared.ts instead, so they can be
 * imported from client components too.
 */
import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import type { Invoice, InvoiceLine } from "@prisma/client";
import type { InvoicePdfData } from "./invoice-pdf";
import type { InvoiceIssuerSettings } from "./settings";

const INVOICE_NO_SEQ_DIGITS = 4;

/**
 * "IN" + 発行年月(YYYYMM) + "-" + 月内連番4桁 の書類番号を発行日から採番する
 * （例: IN202608-0001）。連番は「同じ年月の書類番号の中で一番大きいもの＋1」
 * を都度求めて付与する。
 *
 * 同時に2件作成された場合の重複を避けるため、採番→作成（呼び出し元の
 * prisma.invoice.create）を最大5回までリトライする前提の関数にしている
 * — invoiceNo は @unique 制約があるので、万一同じ連番で衝突しても DB が
 * 確実に弾いてくれる（Prisma の P2002）。呼び出し元は catch した P2002 を
 * ここで採番し直して create をリトライすること（src/app/api/invoices/
 * route.ts 参照）。運用上この採番が同時に競合する頻度は極めて低い
 * （手作業で1件ずつ作る請求書機能）ため、advisory lock 等の重い仕組みは
 * 見送っている。
 */
export async function nextInvoiceNo(issueDate: Date): Promise<string> {
  // 発行年月は JST で決める（Asia/Tokyo 固定 — このプロジェクトの日時表示方針
  // に合わせる）。issueDate は jstDateStringToStartOfDayUtc で保存された
  // UTC instant なので、Asia/Tokyo で年月を取り直す必要がある。
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(issueDate);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const prefix = `IN${year}${month}-`;

  const last = await prisma.invoice.findFirst({
    where: { invoiceNo: { startsWith: prefix } },
    orderBy: { invoiceNo: "desc" },
    select: { invoiceNo: true },
  });

  let nextSeq = 1;
  if (last) {
    const seqStr = last.invoiceNo.slice(prefix.length, prefix.length + INVOICE_NO_SEQ_DIGITS);
    const parsed = parseInt(seqStr, 10);
    if (!isNaN(parsed)) nextSeq = parsed + 1;
  }

  return `${prefix}${String(nextSeq).padStart(INVOICE_NO_SEQ_DIGITS, "0")}`;
}

/** True if `error` is a Prisma unique-constraint violation (P2002). */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

/**
 * Maps a DB Invoice (+ its lines) and the current issuer settings into the
 * shape src/lib/invoice-pdf.ts#generateInvoicePdf expects. Shared by every
 * caller that needs to render the PDF from a stored invoice — originally
 * only src/app/api/invoices/[id]/pdf/route.ts, now also
 * src/app/api/invoices/[id]/send/route.ts (attaches the same PDF to the
 * outgoing email) — so the two call sites can never drift on which fields
 * get passed through. Always reads amounts straight off the `invoice`
 * argument, which callers must have just loaded from Prisma — never from
 * anything client-supplied — so the PDF a recipient gets always matches
 * what's actually stored.
 */
export function toInvoicePdfData(
  invoice: Invoice & { lines: InvoiceLine[] },
  issuer: InvoiceIssuerSettings
): InvoicePdfData {
  return {
    invoiceNo: invoice.invoiceNo,
    recipientName: invoice.recipientName,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    notes: invoice.notes,
    subtotal: invoice.subtotal,
    taxAmount: invoice.taxAmount,
    totalAmount: invoice.totalAmount,
    lines: invoice.lines.map((l) => ({
      date: l.date,
      name: l.name,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      amount: l.amount,
    })),
    issuer,
  };
}
