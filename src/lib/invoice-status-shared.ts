/** エントリーの請求状況（client / server 共用。表示は canSeeInvoiceStatus の人だけ — src/lib/role-shared.ts） */

import { parseReviewStatuses } from "./review-status-shared";

// 請求するのは1次審査を通った商品だけなので、状況を出すのもその商品だけ（審査状況の隣に並べる）。
// 通っていない商品でも請求書が既にあれば出す（後から選外にした等で、請求書の存在を見落とさないため）。
//
// 商品を複数エントリーした企業は1商品の請求書に数量をまとめて請求するので、残りの商品は管理者が
// 手動で「請求済み」にできる（Entry.invoiceMarkedAt）。
//
// 支払いの記録は持っていないので、分かるのは「請求書を送ったか」まで。
// 送信はこのシステムからのメール送信（Invoice.sentAt）だけを数える。PDF を落として
// 別の手段で送った場合は「請求書未送信」のままになる。
export const INVOICE_STATUSES = [
  { value: "none", label: "未請求" },
  { value: "unsent", label: "請求書未送信" },
  { value: "sent", label: "請求済み" },
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]["value"];

export function isInvoiceStatus(v: string): v is InvoiceStatus {
  return INVOICE_STATUSES.some((s) => s.value === v);
}

const FIRST_PASSED = "first_passed";

/**
 * エントリーの審査状況（Entry.reviewStatus）・請求書（何枚でも）・手動の印から状況を決める。
 * 1枚でも送っているか、手動で請求済みにしてあれば請求済み。
 * 請求の対象外（1次審査を通っておらず請求書も手動の印も無い）なら null
 */
export function invoiceStatusOf(
  reviewStatus: string,
  invoices: { sentAt: Date | string | null }[],
  markedAt: Date | string | null,
): InvoiceStatus | null {
  if (invoices.some((inv) => inv.sentAt) || markedAt) return "sent";
  if (invoices.length > 0) return "unsent";
  return parseReviewStatuses(reviewStatus).includes(FIRST_PASSED) ? "none" : null;
}

/** 一覧の絞り込み用。prisma.entry.findMany の where にそのまま入れられる形 */
export function invoiceStatusWhere(status: InvoiceStatus) {
  switch (status) {
    case "none":
      return { reviewStatus: { contains: FIRST_PASSED }, invoices: { none: {} }, invoiceMarkedAt: null };
    case "unsent":
      return { invoices: { some: {}, none: { sentAt: { not: null } } }, invoiceMarkedAt: null };
    case "sent":
      return { OR: [{ invoices: { some: { sentAt: { not: null } } } }, { invoiceMarkedAt: { not: null } }] };
  }
}
