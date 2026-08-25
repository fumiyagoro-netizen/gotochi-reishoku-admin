/**
 * Server-only: renders an Invoice as a PDF using pdf-lib + @pdf-lib/fontkit
 * with a real embedded Japanese font (text stays selectable/searchable —
 * this deliberately does NOT reuse the html2canvas+jsPDF "screenshot the
 * DOM" approach in src/components/pdf-download-button.tsx, which produces
 * an unselectable, blurry-when-zoomed raster image and isn't appropriate
 * for a document the recipient company keeps/prints/re-reads).
 *
 * Font: Noto Sans JP Regular (SIL Open Font License 1.1 — see
 * assets/fonts/OFL.txt), a single static TrueType weight fetched from
 * Google Fonts' own static (non-variable) distribution, chosen because its
 * glyph coverage spans the full JIS X 0213 repertoire (common *and*
 * uncommon kanji), which matters here because an entrant's legal company
 * name can contain a rare kanji we can't predict in advance — a smaller,
 * BMP/JIS-first-level-only font risked a silently missing glyph (tofu box)
 * for exactly the kind of name this feature needs to get right.
 *
 * Font embedding is deliberately NOT subsetted (`embedFont(bytes, {
 * subset: false })`), even though pdf-lib supports per-document glyph
 * subsetting and it was tried first. With subsetting on, pdf-lib's CJK
 * TrueType subsetter drops or corrupts a large fraction of composite/
 * compound glyphs (glyphs built from other glyphs — extremely common for
 * kanji) — confirmed by generating a test PDF and rendering it with
 * multiple independent renderers (pdfjs-dist and macOS's Quartz via
 * `sips`/QuickLook): most kanji came out as *blank gaps*, not even visible
 * tofu boxes, while re-running the exact same draw calls with subsetting
 * off rendered perfectly in both renderers. Given "文字化けは絶対に避ける"
 * is a hard requirement here, the reliable non-subsetted path was kept
 * despite the larger output.
 *
 * That tradeoff is bounded and acceptable: embedding the full ~5.3MB font
 * (compressed via the PDF's normal FlateDecode) produces a PDF of roughly
 * 3.0–3.2MB regardless of how much text is on the page. Vercel Functions
 * cap a non-streaming response body at 4.5MB
 * (https://vercel.com/docs/functions/limitations), so this leaves headroom
 * for the actual invoice content (tens of KB) while staying safely under
 * the limit — see the load-bearing reason a second (bold) weight is NOT
 * also embedded below.
 *
 * No bold weight: adding a second non-subsetted ~5.3MB font would roughly
 * double the output toward/over that 4.5MB cap. Emphasis (title, the large
 * total-due amount) is done with size/boxes instead of a true bold face —
 * see drawEmphasis below.
 */
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import { formatYen } from "./invoice-shared";
import type { InvoiceIssuerSettings } from "./settings";

export interface InvoicePdfLine {
  date: Date;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

export interface InvoicePdfData {
  invoiceNo: string;
  recipientName: string;
  issueDate: Date;
  dueDate: Date;
  notes: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  lines: InvoicePdfLine[];
  issuer: InvoiceIssuerSettings;
}

const PAGE_WIDTH = 595.28; // A4, points
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 45;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 50;

const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.4, 0.4, 0.4);
const LIGHT_GRAY_FILL = rgb(0.92, 0.92, 0.94);
const RULE_GRAY = rgb(0.75, 0.75, 0.75);
const ACCENT_FILL = rgb(0.95, 0.97, 1);

function formatJstDate(date: Date): string {
  return date.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

let cachedFontBytes: Buffer | null = null;
function loadFontBytes(): Buffer {
  if (cachedFontBytes) return cachedFontBytes;
  const fontPath = path.join(process.cwd(), "assets", "fonts", "NotoSansJP-Regular.ttf");
  cachedFontBytes = fs.readFileSync(fontPath);
  return cachedFontBytes;
}

interface DrawCtx {
  page: PDFPage;
  font: PDFFont;
}

function drawText(
  ctx: DrawCtx,
  text: string,
  x: number,
  y: number,
  size: number,
  opts: { color?: ReturnType<typeof rgb>; align?: "left" | "right" | "center"; maxWidth?: number } = {}
) {
  const color = opts.color ?? BLACK;
  let renderText = text;
  // maxWidth 指定時は末尾を "…" に置き換えて収める（品名など自由入力の
  // 明細セルが列幅をはみ出して隣の列に重ならないようにするための保険。
  // 現状の初期データ4件はいずれも短い品名で収まるが、ユーザーが行ごとに
  // 品名を編集できる仕様のため、長い入力への備えとして入れている）。
  if (opts.maxWidth !== undefined && ctx.font.widthOfTextAtSize(renderText, size) > opts.maxWidth) {
    while (renderText.length > 1 && ctx.font.widthOfTextAtSize(renderText + "…", size) > opts.maxWidth) {
      renderText = renderText.slice(0, -1);
    }
    renderText = renderText + "…";
  }
  let drawX = x;
  const width = ctx.font.widthOfTextAtSize(renderText, size);
  if (opts.align === "right") drawX = x - width;
  else if (opts.align === "center") drawX = x - width / 2;
  ctx.page.drawText(renderText, { x: drawX, y, size, font: ctx.font, color });
  return width;
}

// "太字っぽさ" を、実際のボールド書体を持たずに出す簡易手法（faux bold）。
// わずかにずらして重ね描きすることで線が少し太く見える。フォントは
// Regular ウェイト1本のみしか埋め込んでいない（上のファイルコメント参照）
// ための代替であり、本物のボールドほど綺麗ではないが、タイトルやご請求
// 金額のような大きいサイズでの強調には十分な効果がある。
function drawEmphasis(
  ctx: DrawCtx,
  text: string,
  x: number,
  y: number,
  size: number,
  opts: { color?: ReturnType<typeof rgb>; align?: "left" | "right" | "center" } = {}
) {
  const color = opts.color ?? BLACK;
  const width = ctx.font.widthOfTextAtSize(text, size);
  let drawX = x;
  if (opts.align === "right") drawX = x - width;
  else if (opts.align === "center") drawX = x - width / 2;
  for (const dx of [0, 0.4]) {
    ctx.page.drawText(text, { x: drawX + dx, y, size, font: ctx.font, color });
  }
  return width;
}

function drawHLine(page: PDFPage, x1: number, x2: number, y: number, thickness = 0.75, color = RULE_GRAY) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const fontBytes = loadFontBytes();

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`請求書_${data.invoiceNo}`);
  doc.setProducer("ご当地冷凍食品大賞 管理システム");
  // 埋め込みは非サブセット固定 — 理由は上のファイル冒頭コメント参照。
  const font = await doc.embedFont(fontBytes, { subset: false });

  const contentRight = PAGE_WIDTH - MARGIN_X;

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;
  const ctx: DrawCtx = { page, font };

  // --- 右上: 請求書 / 発行日 / 書類番号 ---
  drawEmphasis(ctx, "請求書", contentRight, y - 24, 26, { align: "right" });
  y -= 40;
  drawText(ctx, `発行日：${formatJstDate(data.issueDate)}`, contentRight, y, 10, { align: "right", color: GRAY });
  y -= 16;
  drawText(ctx, `書類番号：${data.invoiceNo}`, contentRight, y, 10, { align: "right", color: GRAY });
  y -= 20;

  // --- 発行者ブロック（右上、日付/書類番号の下） ---
  const issuerLines = [
    data.issuer.issuerName,
    data.issuer.postalAddress,
    data.issuer.email,
    `登録番号：${data.issuer.registrationNumber}`,
  ].filter(Boolean);
  for (const line of issuerLines) {
    drawText(ctx, line, contentRight, y, 9, { align: "right", color: GRAY });
    y -= 13;
  }

  // --- 左上: 宛先 ---
  const recipientY = PAGE_HEIGHT - MARGIN_TOP - 30;
  drawText(ctx, `${data.recipientName} 様`, MARGIN_X, recipientY, 16, { color: BLACK });
  drawHLine(page, MARGIN_X, MARGIN_X + Math.max(200, font.widthOfTextAtSize(`${data.recipientName} 様`, 16) + 10), recipientY - 8, 1, BLACK);

  y = Math.min(y, recipientY - 8) - 30;

  // --- ご請求金額（大きく強調表示） ---
  const amountBoxHeight = 46;
  page.drawRectangle({
    x: MARGIN_X,
    y: y - amountBoxHeight,
    width: contentRight - MARGIN_X,
    height: amountBoxHeight,
    color: ACCENT_FILL,
    borderColor: RULE_GRAY,
    borderWidth: 1,
  });
  drawText(ctx, "ご請求金額", MARGIN_X + 16, y - 28, 12, { color: GRAY });
  drawEmphasis(ctx, `${formatYen(data.totalAmount)}（税込）`, contentRight - 16, y - 32, 22, { align: "right" });
  y -= amountBoxHeight + 30;

  // --- 明細テーブル ---
  const colWidths = { date: 65, name: 195, qty: 45, unitPrice: 95, amount: 105.28 };
  const colX = {
    date: MARGIN_X,
    name: MARGIN_X + colWidths.date,
    qty: MARGIN_X + colWidths.date + colWidths.name,
    unitPrice: MARGIN_X + colWidths.date + colWidths.name + colWidths.qty,
    amount: MARGIN_X + colWidths.date + colWidths.name + colWidths.qty + colWidths.unitPrice,
  };
  const rowHeight = 22;
  const headerHeight = 22;

  function drawTableHeader(topY: number): number {
    page.drawRectangle({
      x: MARGIN_X,
      y: topY - headerHeight,
      width: contentRight - MARGIN_X,
      height: headerHeight,
      color: LIGHT_GRAY_FILL,
    });
    const textY = topY - headerHeight + 7;
    drawText(ctx, "日付", colX.date + 6, textY, 9.5, { color: BLACK });
    drawText(ctx, "品名", colX.name + 6, textY, 9.5, { color: BLACK });
    drawText(ctx, "数量", colX.qty + colWidths.qty - 6, textY, 9.5, { align: "right", color: BLACK });
    drawText(ctx, "単価", colX.unitPrice + colWidths.unitPrice - 6, textY, 9.5, { align: "right", color: BLACK });
    drawText(ctx, "金額", colX.amount + colWidths.amount - 6, textY, 9.5, { align: "right", color: BLACK });
    drawHLine(page, MARGIN_X, contentRight, topY, 1, BLACK);
    drawHLine(page, MARGIN_X, contentRight, topY - headerHeight, 1, BLACK);
    return topY - headerHeight;
  }

  // 明細＋合計欄＋税区分＋振込先＋支払期限＋備考の合計高さがページに収まらない
  // ケース（明細行が多い場合）に備え、必要なら明細の途中でページを追加する。
  // 実運用では明細4行程度を想定しており通常は1ページに収まるが、将来行数が
  // 増えても文字が欠けたりページ外にはみ出したりしないようにするための保険。
  const FOOTER_RESERVE = 230; // 合計欄〜ページ番号までに必要な最低高さの見積もり
  let tableTop = y;
  y = drawTableHeader(tableTop);

  ctx.page = page;
  for (const line of data.lines) {
    if (y - rowHeight < MARGIN_BOTTOM + FOOTER_RESERVE) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      ctx.page = page;
      tableTop = PAGE_HEIGHT - MARGIN_TOP;
      y = drawTableHeader(tableTop);
    }
    const textY = y - rowHeight + 7;
    drawText(ctx, formatJstDateShort(line.date), colX.date + 6, textY, 9.5);
    drawText(ctx, line.name, colX.name + 6, textY, 9.5, { maxWidth: colWidths.name - 12 });
    drawText(ctx, `${line.quantity}${line.unit}`, colX.qty + colWidths.qty - 6, textY, 9.5, { align: "right" });
    drawText(ctx, formatYen(line.unitPrice), colX.unitPrice + colWidths.unitPrice - 6, textY, 9.5, { align: "right" });
    drawText(ctx, formatYen(line.amount), colX.amount + colWidths.amount - 6, textY, 9.5, { align: "right" });
    drawHLine(page, MARGIN_X, contentRight, y - rowHeight);
    y -= rowHeight;
  }
  // 縦罫線（ヘッダー〜明細の下端まで）。改ページを挟んだ場合、tableTop は
  // 最後に描画したページのヘッダー上端を指しているので、その最後のページ
  // 内でのみ正しく縦線が引かれる（複数ページにまたがる縦線は描かない —
  // 改ページ後は drawTableHeader が新しいページに自分のヘッダー罫線を
  // 引いており、縦線もそのページ内で完結していれば十分なため、あえて
  // 単純化している）。
  for (const x of [MARGIN_X, colX.name, colX.qty, colX.unitPrice, colX.amount, contentRight]) {
    page.drawLine({ start: { x, y: tableTop }, end: { x, y }, thickness: 1, color: RULE_GRAY });
  }

  y -= 20;

  // --- 合計欄（右寄せ） ---
  const totalsLabelX = contentRight - 180;
  function totalsRow(label: string, amount: number, size = 10.5) {
    drawText(ctx, label, totalsLabelX, y, size, { color: GRAY });
    drawText(ctx, formatYen(amount), contentRight, y, size, { align: "right" });
    y -= 16;
  }
  totalsRow("合計（税抜）", data.subtotal);
  totalsRow("消費税", data.taxAmount);
  drawHLine(page, totalsLabelX, contentRight, y + 10);
  totalsRow("合計金額", data.totalAmount, 12);
  y -= 8;

  // --- 税区分の表示（10%対象の内訳） ---
  drawText(
    ctx,
    `10%対象：${formatYen(data.subtotal)}　消費税：${formatYen(data.taxAmount)}`,
    MARGIN_X,
    y,
    9,
    { color: GRAY }
  );
  y -= 28;

  // --- 振込先 ---
  drawText(ctx, "お振込先", MARGIN_X, y, 10.5, { color: BLACK });
  y -= 15;
  drawText(ctx, data.issuer.bankInfo, MARGIN_X, y, 10);
  y -= 26;

  // --- お支払い期限 ---
  drawText(ctx, `お支払い期限：${formatJstDate(data.dueDate)}`, MARGIN_X, y, 11, { color: BLACK });
  y -= 26;

  // --- 備考 ---
  if (data.notes.trim()) {
    drawText(ctx, "備考", MARGIN_X, y, 10.5, { color: BLACK });
    y -= 15;
    for (const line of data.notes.split("\n")) {
      drawText(ctx, line, MARGIN_X, y, 9.5, { color: GRAY });
      y -= 14;
    }
  }

  // --- ページ番号 ---
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const label = `${i + 1} / ${pages.length}`;
    const w = font.widthOfTextAtSize(label, 9);
    p.drawText(label, {
      x: PAGE_WIDTH / 2 - w / 2,
      y: MARGIN_BOTTOM - 20,
      size: 9,
      font,
      color: GRAY,
    });
  }

  return doc.save();
}

function formatJstDateShort(date: Date): string {
  return date.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
