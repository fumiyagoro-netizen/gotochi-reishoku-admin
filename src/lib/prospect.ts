import ExcelJS from "exceljs";
import { prisma } from "./prisma";

// Sheet to read from the source workbook. Falls back to the first sheet if
// a sheet with this exact name isn't found (e.g. the file was re-saved with
// a slightly different tab name).
const IMPORT_SHEET_NAME = "メーカーリスト";

// Master-data columns pulled from the Excel file, mapped by header text so
// column order in the spreadsheet doesn't matter. The four operational
// columns (コンタクト状況/担当者/連絡先/備考・メモ欄) are intentionally NOT
// read from the file — new rows always start from the Prisma schema
// defaults ("未着手" / "" / "" / ""), and existing rows are skipped
// entirely on re-import (see importProspectsFromExcel below), so those
// hand-maintained columns are never touched by an import either way.
const IMPORT_FIELD_HEADERS = {
  makerName: "メーカー名",
  prefecture: "県名",
  productName: "商品名",
  tempZone: "サイトで確認できる温度帯",
  supplement: "補足",
  url: "URL",
} as const;

type ImportField = keyof typeof IMPORT_FIELD_HEADERS;

export interface ImportProspectsResult {
  created: number;
  skippedDuplicate: number;
  skippedInvalid: number;
  total: number;
}

/** Convert an ExcelJS cell value to a plain trimmed string, regardless of
 * whether the cell holds a plain string, a hyperlink ({text, hyperlink}),
 * rich text ({richText: [...]}), or a formula result ({formula, result}).
 * The source file's URL column is stored as a hyperlink cell, so this is
 * required just to read that column; the richText/formula handling is
 * defensive in case a future re-export of the list introduces them
 * elsewhere. */
function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      return value.hyperlink.trim();
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text ?? "").join("").trim();
    }
    if ("result" in value) {
      return cellToString(value.result as ExcelJS.CellValue);
    }
    return "";
  }
  return String(value).trim();
}

/** Dedupe key: same メーカー名＋商品名 pair (trimmed, exact match) within the
 * SAME award (year) is considered "already tracked" and is skipped on
 * import — see the Prospect model comment in prisma/schema.prisma for why.
 * The same pair in a *different* award/year is NOT a duplicate: the list is
 * rebuilt from a fresh Excel file every year, so a maker that was on last
 * year's list must still be importable this year. */
function dedupeKey(makerName: string, productName: string): string {
  return `${makerName.trim()} ${productName.trim()}`;
}

/**
 * Import prospects from an uploaded .xlsx buffer into the given award
 * (year). Reads the "メーカーリスト" sheet (or the first sheet if that's not
 * found), maps columns by header text, and creates a new Prospect for every
 * row whose メーカー名＋商品名 pair isn't already tracked *within that same
 * award* (existing rows, in this or any other award, are left completely
 * untouched — no merge, no overwrite). Duplicates *within* the uploaded file
 * itself are also skipped after the first occurrence.
 */
export async function importProspectsFromExcel(
  buffer: Buffer,
  awardId: number
): Promise<ImportProspectsResult> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's bundled type defs predate the generic Buffer<TArrayBuffer>
  // introduced in newer @types/node, so a plain Buffer.from(...) result
  // doesn't structurally satisfy its Buffer param type — same class of
  // mismatch as the `as any` cast in src/app/api/entries/export/route.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);

  const sheet = workbook.getWorksheet(IMPORT_SHEET_NAME) ?? workbook.worksheets[0];
  if (!sheet) {
    throw new Error("読み込めるシートが見つかりません");
  }

  const columnByHeader = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const header = cellToString(cell.value);
    if (header) columnByHeader.set(header, colNumber);
  });

  const makerNameCol = columnByHeader.get(IMPORT_FIELD_HEADERS.makerName);
  if (!makerNameCol) {
    throw new Error(
      `ヘッダーに「${IMPORT_FIELD_HEADERS.makerName}」列が見つかりません`
    );
  }

  // Dedupe is scoped to this award only — a maker tracked in a different
  // year's list is not "already tracked" for this import.
  const existing = await prisma.prospect.findMany({
    where: { awardId },
    select: { makerName: true, productName: true },
  });
  const existingKeys = new Set(
    existing.map((p) => dedupeKey(p.makerName, p.productName))
  );

  const newRows: {
    awardId: number;
    makerName: string;
    prefecture: string;
    productName: string;
    tempZone: string;
    supplement: string;
    url: string;
  }[] = [];
  let skippedDuplicate = 0;
  let skippedInvalid = 0;

  function getField(row: ExcelJS.Row, field: ImportField): string {
    const col = columnByHeader.get(IMPORT_FIELD_HEADERS[field]);
    if (!col) return "";
    return cellToString(row.getCell(col).value);
  }

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // header row

    const makerName = getField(row, "makerName");
    if (!makerName) {
      skippedInvalid++;
      return;
    }

    const productName = getField(row, "productName");
    const key = dedupeKey(makerName, productName);
    if (existingKeys.has(key)) {
      skippedDuplicate++;
      return;
    }
    existingKeys.add(key); // also guards against dupes within this same file

    newRows.push({
      awardId,
      makerName,
      prefecture: getField(row, "prefecture"),
      productName,
      tempZone: getField(row, "tempZone"),
      supplement: getField(row, "supplement"),
      url: getField(row, "url"),
    });
  });

  if (newRows.length > 0) {
    await prisma.prospect.createMany({ data: newRows });
  }

  return {
    created: newRows.length,
    skippedDuplicate,
    skippedInvalid,
    total: newRows.length + skippedDuplicate + skippedInvalid,
  };
}
