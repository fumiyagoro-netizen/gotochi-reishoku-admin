import { GRAND_PRIX_PRIZE_LEVEL, isPrizeLevel } from "./prize-shared";

/**
 * 過去の受賞商品の取り込み（サイト管理 → 過去の受賞商品の取り込み）で、画面とサーバーの両方が使う型と検証。
 * Excel の読み取りは src/lib/site-import.ts（exceljs を使うのでサーバー専用）。
 * 取り込むエントリーは回答番号を IMPORT-<年度>-<No> にして、同じ行を二度登録しない。
 */

export const IMPORT_MAX_PHOTOS = 3;

export type ImportRow = {
  /** Excel の No 列 */
  no: number;
  /** IMPORT-2025-007 の形。重複登録の判定に使う */
  answerNo: string;
  /** サイトに出す商品名（Excel の「サイト表示名」。空なら評価シートの商品名） */
  productName: string;
  /** 評価シート上の商品名（備考に残す） */
  sheetProductName: string;
  companyName: string;
  prefecture: string;
  prizeLevel: string;
  grandPrix: boolean;
  /** 「審査員特別賞 西川剛史賞」のような特別賞の表記。無ければ "" */
  specialAward: string;
  referenceUrl: string;
  localAppeal: string;
  tasteAppeal: string;
  packageAppeal: string;
  cookingMethod: string;
  otherAppeal: string;
  price: string;
  purchaseLocation: string;
  volume: string;
  /** 評価シートの受賞結果の原文（備考に残す） */
  originalResult: string;
  /** 写真のファイル名（1枚目がメイン） */
  photos: string[];
  /** 取り込みを止める問題 */
  errors: string[];
  /** 取り込めるが確認してほしいこと */
  warnings: string[];
  /** 同じ回答番号のエントリーが既にある（取り込み済み） */
  exists?: boolean;
};

export function importAnswerNo(year: number, no: number): string {
  return `IMPORT-${year}-${String(no).padStart(3, "0")}`;
}

/** 行ごとの検証。errors / warnings を上書きして返す（行をまたぐ検証は validateImportRows） */
export function validateImportRow(row: ImportRow): ImportRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!Number.isInteger(row.no) || row.no <= 0) errors.push("No が数字ではありません");
  if (!row.productName) errors.push("商品名がありません");
  if (!row.companyName) errors.push("企業名がありません");
  if (!isPrizeLevel(row.prizeLevel)) errors.push(`賞「${row.prizeLevel || "（空）"}」は最高金賞・金賞・銀賞・銅賞のどれかにしてください`);
  if (row.grandPrix && row.prizeLevel !== GRAND_PRIX_PRIZE_LEVEL) errors.push("グランプリは最高金賞の商品にだけ付けられます");
  if (row.photos.length > IMPORT_MAX_PHOTOS) errors.push(`写真は${IMPORT_MAX_PHOTOS}枚までです`);
  if (new Set(row.photos).size !== row.photos.length) errors.push("同じ写真が2回指定されています");
  if (row.photos.length === 0) warnings.push("写真がありません（写真なしで登録します）");
  if (!row.prefecture) warnings.push("都道府県がありません");
  if (row.referenceUrl && !/^https?:\/\//.test(row.referenceUrl)) warnings.push("参考URLが http で始まっていません");
  return { ...row, errors, warnings };
}

/** ファイル全体の検証（No の重複、グランプリが2品以上）。該当行に errors を足し、ファイル全体の問題も返す */
export function validateImportRows(rows: ImportRow[]): { rows: ImportRow[]; fileErrors: string[] } {
  const fileErrors: string[] = [];
  const checked = rows.map(validateImportRow);
  const seen = new Map<number, number>();
  for (const r of checked) seen.set(r.no, (seen.get(r.no) ?? 0) + 1);
  for (const r of checked) if ((seen.get(r.no) ?? 0) > 1) r.errors.push(`No ${r.no} が重複しています`);
  const gp = checked.filter((r) => r.grandPrix);
  if (gp.length > 1) {
    fileErrors.push(`グランプリが ${gp.length}品に付いています（1品だけにしてください）`);
    for (const r of gp) r.errors.push("グランプリが複数あります");
  }
  if (checked.length === 0) fileErrors.push("取り込める行がありません（「商品名（評価シート）」の列がある表を読み込みます）");
  return { rows: checked, fileErrors };
}
