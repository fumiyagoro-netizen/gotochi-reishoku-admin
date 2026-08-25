/**
 * Shared invoice types/constants/pure helpers — safe for both client and
 * server (no Prisma import here; see src/lib/invoice.ts for the
 * server-only DB/PDF-adjacent logic that builds on top of this).
 */

// 消費税率。既存請求書実物は10%のみで、軽減税率（8%）が必要な品目は
// この請求書機能の対象（エントリー費用等の役務提供）には存在しないため、
// 複数税率の混在は考慮しない単一税率としている。
export const TAX_RATE = 0.1;

// 明細行の単位の既定値。既存請求書実物の「3式 × ¥30,000」に合わせる。
export const DEFAULT_UNIT = "式";

// 請求書の備考欄の初期値（ユーザー確定文言）。Invoice.notes の DB 上の
// デフォルトは空文字のままにしてあり（prisma/schema.prisma 参照）、この
// 定数は新規作成フォームが初期表示する値としてのみ使う — 後からこの文言を
// 変えても、すでに作成済みの請求書の備考は変わらないようにするため。
export const DEFAULT_INVOICE_NOTES =
  "※ 社内都合などにより期限内にお支払いが難しい場合は個別にご相談下さい。\n" +
  "※ 振り込み手数料は御社負担にてお願い致します。";

/**
 * 円額を "¥12,345" / "-¥5,000" の形式に整形する。マイナス金額（早期割引など）
 * は符号を¥の前に出す — `` `¥${n.toLocaleString()}` `` だと "¥-5,000" になり
 * 見た目が不自然なため、符号とその他を分けて組み立てている。
 */
export function formatYen(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}¥${Math.abs(amount).toLocaleString("ja-JP")}`;
}

const YYYY_MM_DD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * "YYYY-MM-DD" の発行日から、既定の支払期限「発行月の翌月末」を同じく
 * "YYYY-MM-DD" 形式で返す（<input type="date"> の value にそのまま使える形）。
 * 純粋な暦計算のみで、タイムゾーンに依存する Date 演算は使わない —
 * `Date.UTC` は「その年月の0日目 = 前月末日」を取る便宜上の計算に使っているが、
 * 入力・出力とも常にカレンダー上の年月日の文字列で完結しており、サーバーの
 * 実行タイムゾーンに影響されない。
 * 不正な入力には空文字を返す。
 */
export function defaultDueDateFromIssueDate(issueDateStr: string): string {
  const m = YYYY_MM_DD_RE.exec(issueDateStr);
  if (!m) return "";
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10); // 1-12
  // 翌月（1-indexed, 13 になったら翌年1月に繰り上げる）
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthYear = month === 12 ? year + 1 : year;
  // 「翌月の月末日」= 「翌々月の0日目」。Date.UTC の month は 0-indexed かつ
  // day=0 は前月末日を指すので、month に nextMonth（1-indexed のまま）を渡すと
  // ちょうど「nextMonth の月末日」になる。
  const lastDay = new Date(Date.UTC(nextMonthYear, nextMonth, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${nextMonthYear}-${pad(nextMonth)}-${pad(lastDay)}`;
}

export interface InvoiceLineInput {
  date: string; // "YYYY-MM-DD"
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

/**
 * 明細行から税抜合計・消費税・税込合計を計算する。消費税は円未満切り捨て
 * （一般的な処理として採用 — 既存請求書実物からは端数処理の判断材料が
 * 取れなかったため。src/lib/invoice.ts 側のコメント、および今回の報告
 * 参照）。この関数はクライアント（合計のプレビュー表示用）・サーバー
 * （実際に保存する値の計算用）の両方から呼ばれるが、保存される値は必ず
 * サーバー側でこの関数を呼び直した結果であり、クライアントが計算した値を
 * そのまま信用することはない（src/app/api/invoices/route.ts 等参照）。
 */
export function calcInvoiceTotals(lines: { quantity: number; unitPrice: number }[]): {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
} {
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const taxAmount = Math.floor(subtotal * TAX_RATE);
  const totalAmount = subtotal + taxAmount;
  return { subtotal, taxAmount, totalAmount };
}
