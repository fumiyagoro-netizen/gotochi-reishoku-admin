import ExcelJS from "exceljs";
import { importAnswerNo, validateImportRows, type ImportRow } from "./site-import-shared";

/**
 * 過去の受賞商品の取り込み用 Excel を読む（サーバー専用）。
 * 形式は「第1回_受賞商品リスト」（事務局と作ったもの）: 1行目が見出しで、「商品名（評価シート）」列がある表を探す。
 * 見出し名で列を引くので、列の並び替え・追加には強い。
 */

const HEAD = {
  no: "No",
  prize: "賞",
  grandPrix: "グランプリ",
  special: "特別賞",
  sheetName: "商品名（評価シート）",
  displayName: "サイト表示名",
  company: "企業名",
  prefecture: "都道府県",
  url: "参考URL",
  local: "ご当地のこだわり",
  photo1: "写真1（メイン）",
  photo2: "写真2",
  photo3: "写真3",
  taste: "おいしさのこだわり",
  package: "パッケージのこだわり",
  cooking: "調理方法",
  other: "その他アピール",
  volume: "内容量",
  price: "上代価格（税込）",
  channel: "購入可能場所",
  original: "受賞結果（評価シート原文）",
} as const;

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const o = value as unknown as Record<string, unknown>;
  if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((r) => r.text).join("").trim();
  if ("text" in o) return String(o.text ?? "").trim(); // ハイパーリンク
  if ("result" in o) return o.result == null ? "" : String(o.result).trim(); // 数式
  return "";
}

export async function parseImportWorkbook(
  buffer: ArrayBuffer,
  year: number,
): Promise<{ rows: ImportRow[]; fileErrors: string[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const sheet = wb.worksheets.find((ws) => {
    const head = ws.getRow(1).values as ExcelJS.CellValue[];
    return head.some((v) => cellText(v) === HEAD.sheetName);
  });
  if (!sheet) {
    return { rows: [], fileErrors: [`「${HEAD.sheetName}」の列がある表が見つかりません`] };
  }

  const col = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, n) => col.set(cellText(cell.value), n));
  const missing = [HEAD.prize, HEAD.company, HEAD.photo1].filter((h) => !col.has(h));
  if (missing.length > 0) {
    return { rows: [], fileErrors: [`見出しが見つかりません: ${missing.join("、")}`] };
  }

  const rows: ImportRow[] = [];
  sheet.eachRow((r, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (h: string) => (col.has(h) ? cellText(r.getCell(col.get(h)!).value) : "");
    const sheetName = get(HEAD.sheetName);
    if (!sheetName) return;
    const no = Number(get(HEAD.no));
    rows.push({
      no,
      answerNo: importAnswerNo(year, no),
      productName: get(HEAD.displayName) || sheetName,
      sheetProductName: sheetName,
      companyName: get(HEAD.company),
      prefecture: get(HEAD.prefecture),
      prizeLevel: get(HEAD.prize),
      grandPrix: get(HEAD.grandPrix) !== "",
      specialAward: get(HEAD.special),
      referenceUrl: get(HEAD.url),
      localAppeal: get(HEAD.local),
      tasteAppeal: get(HEAD.taste),
      packageAppeal: get(HEAD.package),
      cookingMethod: get(HEAD.cooking),
      otherAppeal: get(HEAD.other),
      price: get(HEAD.price),
      purchaseLocation: get(HEAD.channel),
      volume: get(HEAD.volume),
      originalResult: get(HEAD.original),
      photos: [get(HEAD.photo1), get(HEAD.photo2), get(HEAD.photo3)].filter(Boolean),
      errors: [],
      warnings: [],
    });
  });

  return validateImportRows(rows);
}
