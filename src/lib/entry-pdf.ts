/**
 * Server-only: renders one Entry as an A4 PDF with real, selectable text.
 *
 * Replaces the html2canvas + jsPDF "screenshot the detail screen" approach
 * that src/components/pdf-download-button.tsx used to run in the browser.
 * That produced a JPEG of screen-rendered text pasted into A4 — unselectable,
 * unsearchable, soft when zoomed or printed, and page-broken by slicing one
 * tall image at fixed heights (so rows and photos were cut mid-way). This
 * module lays the document out itself, so breaks land between blocks.
 *
 * Audience decides the content: the sheet goes to judges and is shared with
 * 後援・協賛, so it carries the product's case and the company's compliance
 * facts, and deliberately omits the applicant's personal details (担当者名 /
 * メール / 電話 / 部署) and the office's own review state (審査状況 / 商品到着
 * / 受賞). Anything added here must clear that same bar.
 *
 * Font: Noto Sans JP Regular, embedded whole. See src/lib/invoice-pdf.ts for
 * the reasoning that applies identically here — briefly: pdf-lib's CJK
 * subsetter corrupts composite glyphs, so `subset: false` is load-bearing,
 * which fixes ~3.0MB of the output before any content. Vercel caps a
 * non-streaming response body at 4.5MB, and unlike an invoice this document
 * carries photographs, so PHOTO_BUDGET below is what keeps the two apart.
 *
 * The font loader is duplicated rather than shared with invoice-pdf.ts on
 * purpose: invoices are tax documents already sent to customers, and a
 * refactor there buys nothing (each route is its own serverless function, so
 * there is no cache to share) while risking a working document.
 */
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";
import fs from "fs";
import path from "path";

export interface EntryPdfPhoto {
  bytes: Buffer;
  /** "main" のものを大きく先頭に置く */
  isMain: boolean;
}

export interface EntryPdfData {
  awardName: string;
  answerNo: string;
  productName: string;
  companyName: string;
  prefecture: string;
  productCategory: string;
  price: string;
  purchaseLocation: string;
  referenceUrl: string;
  localAppeal: string;
  tasteAppeal: string;
  packageAppeal: string;
  cookingMethod: string;
  otherAppeal: string;
  tradeShowExhibition: string;
  retailPartnership: string;
  bacteriaInspection: string;
  expirationInspection: string;
  manufacturingLicense: string;
  entryProductLicense: string;
  hygieneManager: string;
  photos: EntryPdfPhoto[];
}

const PAGE_WIDTH = 595.28; // A4, points
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 45;
const MARGIN_TOP = 52;
const MARGIN_BOTTOM = 46;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const BLACK = rgb(0.09, 0.09, 0.11);
const GRAY = rgb(0.42, 0.42, 0.47);
const FAINT = rgb(0.62, 0.62, 0.67);
const RULE = rgb(0.85, 0.85, 0.87);
const BAND = rgb(0.96, 0.96, 0.97);

/** 写真に使ってよい合計バイト数。フォント約3.0MB＋本文に対し、Vercel の
 *  4.5MB 応答上限まで余裕を残す。超える場合は下の PHOTO_STEPS で段階的に
 *  縮小・再圧縮する。 */
const PHOTO_BUDGET = 900 * 1024;
const PHOTO_STEPS = [
  { main: 1400, sub: 900, quality: 80 },
  { main: 1100, sub: 720, quality: 72 },
  { main: 900, sub: 600, quality: 62 },
];

let cachedFont: Buffer | null = null;
function loadFontBytes(): Buffer {
  if (cachedFont) return cachedFont;
  const fontPath = path.join(process.cwd(), "assets", "fonts", "NotoSansJP-Regular.ttf");
  cachedFont = fs.readFileSync(fontPath);
  return cachedFont;
}

interface Doc {
  pdf: PDFDocument;
  font: PDFFont;
  page: PDFPage;
  y: number;
  pageNo: number;
  awardName: string;
  answerNo: string;
}

function drawFooter(d: Doc) {
  const label = `${d.awardName}　エントリーシート`;
  d.page.drawText(label, {
    x: MARGIN_X, y: MARGIN_BOTTOM - 18, size: 8, font: d.font, color: FAINT,
  });
  const no = String(d.pageNo);
  d.page.drawText(no, {
    x: PAGE_WIDTH - MARGIN_X - d.font.widthOfTextAtSize(no, 8),
    y: MARGIN_BOTTOM - 18, size: 8, font: d.font, color: FAINT,
  });
}

function newPage(d: Doc) {
  drawFooter(d);
  d.page = d.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  d.pageNo += 1;
  d.y = PAGE_HEIGHT - MARGIN_TOP;
  // 2ページ目以降は、どのエントリーの続きか分かるように受付番号を小さく出す
  d.page.drawText(d.answerNo, {
    x: PAGE_WIDTH - MARGIN_X - d.font.widthOfTextAtSize(d.answerNo, 8),
    y: d.y + 12, size: 8, font: d.font, color: FAINT,
  });
}

/** 残り高さが足りなければ改ページする。ブロック単位で呼ぶことで、
 *  見出しだけがページ末尾に取り残されるのを防ぐ。 */
function ensure(d: Doc, height: number) {
  if (d.y - height < MARGIN_BOTTOM) newPage(d);
}

/**
 * 日本語は原則どこでも折り返せるが、英数字の途中で切れると読みにくいので
 * 直前の空白まで戻す。改行はそのまま活かす。
 */
function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    if (rawLine === "") {
      out.push("");
      continue;
    }
    let line = "";
    for (const ch of rawLine) {
      const next = line + ch;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        line = next;
        continue;
      }
      if (line === "") {
        out.push(ch); // 1文字で幅を超える場合はそのまま出す
        continue;
      }
      // 英数字の語中で切れるなら、直前の空白まで巻き戻す
      const isWordChar = (c: string) => /[0-9A-Za-z@.\-_/:]/.test(c);
      if (isWordChar(ch) && isWordChar(line[line.length - 1])) {
        const sp = line.lastIndexOf(" ");
        if (sp > 0) {
          out.push(line.slice(0, sp));
          line = line.slice(sp + 1) + ch;
          continue;
        }
      }
      out.push(line);
      line = ch;
    }
    out.push(line);
  }
  return out;
}

/** 太字の代わりに 0.4pt ずらして二度描く。太字を別ファイルで埋め込むと
 *  出力が上限を超えるため（invoice-pdf.ts と同じ手当て）。 */
function drawBold(d: Doc, text: string, x: number, y: number, size: number, color = BLACK) {
  for (const dx of [0, 0.4]) {
    d.page.drawText(text, { x: x + dx, y, size, font: d.font, color });
  }
}

function drawParagraph(d: Doc, text: string, size: number, leading: number, color = BLACK) {
  for (const line of wrapText(d.font, text, size, CONTENT_WIDTH)) {
    ensure(d, leading);
    if (line !== "") {
      d.page.drawText(line, { x: MARGIN_X, y: d.y - size, size, font: d.font, color });
    }
    d.y -= leading;
  }
}

function sectionHeading(d: Doc, title: string) {
  // 見出しの高さ(46)だけでなく、続く1行ぶん(30)も入るか見る。
  // 見出しだけがページ末尾に残るのを防ぐため
  ensure(d, 76);
  d.y -= 14;
  d.page.drawRectangle({
    x: MARGIN_X, y: d.y - 17, width: CONTENT_WIDTH, height: 21, color: BAND,
  });
  drawBold(d, title, MARGIN_X + 8, d.y - 11, 10.5);
  d.y -= 29;
}

/** ラベルと本文の2列。どちらも列幅で折り返し、長いほうの行数ぶん送る。
 *  ラベルも折り返すのは、「営業許可証（エントリー商品）」のような長いラベルが
 *  列をはみ出して値に重なるのを防ぐため。 */
function labelledRow(d: Doc, label: string, value: string) {
  const labelWidth = 142;
  const bodyX = MARGIN_X + labelWidth;
  const bodyWidth = CONTENT_WIDTH - labelWidth;
  const labelLines = wrapText(d.font, label, 9, labelWidth - 10);
  const lines = wrapText(d.font, value || "―", 9.5, bodyWidth);
  const rows = Math.max(labelLines.length, lines.length);
  const height = Math.max(rows * 14, 16) + 6;
  ensure(d, height);

  const top = d.y;
  labelLines.forEach((line, i) => {
    d.page.drawText(line, { x: MARGIN_X, y: top - 10 - i * 14, size: 9, font: d.font, color: GRAY });
  });
  lines.forEach((line, i) => {
    d.page.drawText(line, {
      x: bodyX, y: top - 10 - i * 14, size: 9.5, font: d.font,
      color: value ? BLACK : FAINT,
    });
  });
  d.y = top - height;
  d.page.drawLine({
    start: { x: MARGIN_X, y: d.y + 3 }, end: { x: MARGIN_X + CONTENT_WIDTH, y: d.y + 3 },
    thickness: 0.5, color: RULE,
  });
}

/** 見出し＋本文のブロック。本文が空なら丸ごと出さない（審査資料に
 *  「―」だけの節が並ぶのを避ける）。 */
function appealBlock(d: Doc, title: string, body: string) {
  if (!body.trim()) return;
  ensure(d, 40);
  d.y -= 4;
  drawBold(d, title, MARGIN_X, d.y - 10, 9.5, GRAY);
  d.y -= 18;
  drawParagraph(d, body.trim(), 10, 15.5);
  d.y -= 4;
}

/**
 * 写真を JPEG に正規化する。保存されている画像には webp が 6 割ほど混ざって
 * おり pdf-lib はそのままでは埋め込めない。あわせて縮小し、合計が
 * PHOTO_BUDGET に収まるまで段階的に品質を落とす。
 */
async function normalisePhotos(
  photos: EntryPdfPhoto[]
): Promise<{ jpeg: Buffer; isMain: boolean }[]> {
  for (const step of PHOTO_STEPS) {
    const out: { jpeg: Buffer; isMain: boolean }[] = [];
    let total = 0;
    for (const p of photos) {
      try {
        const max = p.isMain ? step.main : step.sub;
        const jpeg = await sharp(p.bytes, { failOn: "none" })
          .rotate() // EXIF の向きを反映（スマートフォン撮影の写真が横倒しになるのを防ぐ）
          .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: step.quality })
          .toBuffer();
        out.push({ jpeg, isMain: p.isMain });
        total += jpeg.length;
      } catch {
        // 画像として読めないもの（PDF が紛れているエントリーが3件ある）は飛ばす
      }
    }
    if (total <= PHOTO_BUDGET || step === PHOTO_STEPS[PHOTO_STEPS.length - 1]) return out;
  }
  return [];
}

export async function generateEntryPdf(data: EntryPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // locl を切る理由: Noto Sans JP の locl は「英字に挟まれた数字」を別グリフ
  // （id 16306 以降）に差し替える。そのグリフの送り幅は元と同じ 555 なのに、
  // pdf-lib が書き出す幅表では正しく引けず、閲覧側が既定幅（全角）で送って
  // しまい "…stkn=dmFlMXN5 djd0 OTE1" のように語中に隙間が空く（参考URL や
  // 商品名で実際に発生）。日本語側への影響が無いことは、実データの社名・
  // 地名・商品名・旧字体（髙島屋・齋藤・渡邊）で locl 有無のグリフ ID を
  // 突き合わせて確認済み（157 グリフ中 0 個が変化）。
  const font = await pdf.embedFont(loadFontBytes(), { subset: false, features: { locl: false } });

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const d: Doc = {
    pdf, font, page, y: PAGE_HEIGHT - MARGIN_TOP, pageNo: 1,
    awardName: data.awardName, answerNo: data.answerNo,
  };

  // ── ヘッダー
  d.page.drawText(data.awardName, { x: MARGIN_X, y: d.y, size: 9.5, font, color: GRAY });
  const noText = `受付番号 ${data.answerNo}`;
  d.page.drawText(noText, {
    x: PAGE_WIDTH - MARGIN_X - font.widthOfTextAtSize(noText, 9.5),
    y: d.y, size: 9.5, font, color: GRAY,
  });
  d.y -= 12;
  d.page.drawLine({
    start: { x: MARGIN_X, y: d.y }, end: { x: MARGIN_X + CONTENT_WIDTH, y: d.y },
    thickness: 0.8, color: RULE,
  });
  d.y -= 30;

  // ── 商品名・企業名
  for (const line of wrapText(font, data.productName, 19, CONTENT_WIDTH)) {
    ensure(d, 26);
    drawBold(d, line, MARGIN_X, d.y - 19, 19);
    d.y -= 26;
  }
  d.y -= 2;
  d.page.drawText(data.companyName, { x: MARGIN_X, y: d.y - 11, size: 11, font, color: GRAY });
  d.y -= 24;

  // ── 商品情報
  sectionHeading(d, "商品情報");
  labelledRow(d, "ご当地（都道府県）", data.prefecture);
  labelledRow(d, "カテゴリ", data.productCategory);
  labelledRow(d, "販売価格", data.price);
  labelledRow(d, "購入可能場所", data.purchaseLocation);
  labelledRow(d, "参考URL", data.referenceUrl);

  // ── 商品写真
  const photos = await normalisePhotos(data.photos);
  if (photos.length > 0) {
    sectionHeading(d, "商品写真");
    const main = photos.find((p) => p.isMain) ?? photos[0];
    const subs = photos.filter((p) => p !== main);

    const mainImg = await pdf.embedJpg(main.jpeg);
    const mainMaxH = 250;
    const mainScale = Math.min(CONTENT_WIDTH / mainImg.width, mainMaxH / mainImg.height, 1);
    const mw = mainImg.width * mainScale;
    const mh = mainImg.height * mainScale;
    ensure(d, mh + 10);
    d.page.drawImage(mainImg, { x: MARGIN_X + (CONTENT_WIDTH - mw) / 2, y: d.y - mh, width: mw, height: mh });
    d.y -= mh + 12;

    if (subs.length > 0) {
      const gap = 10;
      const cellW = (CONTENT_WIDTH - gap * (subs.length - 1)) / subs.length;
      const cellH = Math.min(130, cellW);
      ensure(d, cellH + 8);
      const top = d.y;
      for (let i = 0; i < subs.length; i++) {
        const img = await pdf.embedJpg(subs[i].jpeg);
        const s = Math.min(cellW / img.width, cellH / img.height, 1);
        const w = img.width * s;
        const h = img.height * s;
        d.page.drawImage(img, {
          x: MARGIN_X + i * (cellW + gap) + (cellW - w) / 2,
          y: top - h, width: w, height: h,
        });
      }
      d.y = top - cellH - 8;
    }
  }

  // ── アピールポイント（入力のあるものだけ）
  const appeals: [string, string][] = [
    ["ご当地のこだわり", data.localAppeal],
    ["おいしさのこだわり", data.tasteAppeal],
    ["パッケージのこだわり", data.packageAppeal],
    ["調理方法・おすすめの食べ方", data.cookingMethod],
    ["その他アピール", data.otherAppeal],
  ];
  if (appeals.some(([, body]) => body.trim())) {
    sectionHeading(d, "アピールポイント");
    for (const [title, body] of appeals) appealBlock(d, title, body);
  }

  // ── 出展・販売意向
  sectionHeading(d, "出展・販売意向");
  labelledRow(d, "トレードショー出展", data.tradeShowExhibition);
  labelledRow(d, "小売業者での販売希望", data.retailPartnership);

  // ── 許認可・衛生情報
  sectionHeading(d, "許認可・衛生情報");
  labelledRow(d, "食品細菌検査", data.bacteriaInspection);
  labelledRow(d, "賞味期限検査証", data.expirationInspection);
  labelledRow(d, "営業許可証（製造販売）", data.manufacturingLicense);
  labelledRow(d, "営業許可証（エントリー商品）", data.entryProductLicense);
  labelledRow(d, "食品衛生責任者", data.hygieneManager);

  drawFooter(d);
  return pdf.save();
}
