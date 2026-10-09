import { gzipSync } from "node:zlib";
import { del, list, put } from "@vercel/blob";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * データベースのバックアップ（サーバー専用）。
 *
 * 全テーブルの全行を1つの JSON にまとめ、gzip で圧縮して Vercel Blob（private）の backups/db/ に置く。
 * 毎日 Vercel Cron（vercel.json → /api/cron/backup）が呼ぶほか、管理画面の「設定」から手動でも取れる。
 * 戻すときは scripts/restore-backup.ts で「空の新しいデータベース」に入れる（今のデータベースには上書きしない）。
 *
 * Neon 自体の復元機能（時点を指定した復元）とは別の、アプリ側の備え。Neon のアカウントやプロジェクトに
 * 何かあったときでも、ここに残っている日ごとの写しから戻せる。
 */

export const BACKUP_PREFIX = "backups/db/";
/** この日数より古いバックアップは消す（ただし新しいものから KEEP_AT_LEAST 件は日数に関係なく残す） */
export const BACKUP_RETENTION_DAYS = 30;
const KEEP_AT_LEAST = 7;
/** バックアップの形が変わったら上げる（scripts/restore-backup.ts が読める版かの確認に使う） */
export const BACKUP_FORMAT = 1;

export type BackupFile = {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: string;
};

export type BackupResult = {
  pathname: string;
  size: number;
  rows: number;
  counts: Record<string, number>;
};

/** Prisma のモデル名 → prisma.xxx の名前（Entry → entry、SiteAwardSettings → siteAwardSettings） */
function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

type Delegate = { findMany: (args?: unknown) => Promise<unknown[]> };

/** 日本時間の日付と時刻（ファイル名用）。例: 2026-10-10_0300 */
function jstStamp(d: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${v("year")}-${v("month")}-${v("day")}_${v("hour")}${v("minute")}`;
}

export async function listBackups(): Promise<BackupFile[]> {
  const files: BackupFile[] = [];
  let cursor: string | undefined;
  do {
    const res = await list({ prefix: BACKUP_PREFIX, cursor, limit: 1000 });
    for (const b of res.blobs) {
      files.push({ pathname: b.pathname, url: b.url, size: b.size, uploadedAt: b.uploadedAt.toISOString() });
    }
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor);
  return files.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/** 日本時間の今日の分がもう取れているか（毎日の自動バックアップが二重に走らないように） */
export async function hasBackupToday(): Promise<boolean> {
  const today = jstStamp(new Date()).slice(0, 10);
  const files = await listBackups();
  return files.some((f) => f.pathname.startsWith(`${BACKUP_PREFIX}${today}`));
}

/** 全テーブルを読んで、gzip した JSON をつくる（保存はしない。scripts/restore-backup.ts の確認にも使う） */
export async function buildBackup(trigger: "cron" | "manual", now = new Date()) {
  const models = Prisma.dmmf.datamodel.models;
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  // 1テーブルずつ読む（同時に投げるとデータベースの接続を使い切ることがある）
  for (const model of models) {
    const delegate = (prisma as unknown as Record<string, Delegate>)[delegateName(model.name)];
    const hasId = model.fields.some((f) => f.name === "id");
    const rows = await delegate.findMany(hasId ? { orderBy: { id: "asc" } } : undefined);
    tables[model.name] = rows;
    counts[model.name] = rows.length;
  }
  const rows = Object.values(counts).reduce((a, b) => a + b, 0);
  const body = gzipSync(
    JSON.stringify({ format: BACKUP_FORMAT, createdAt: now.toISOString(), trigger, counts, tables }),
  );
  return { body, rows, counts };
}

export async function createBackup(trigger: "cron" | "manual"): Promise<BackupResult> {
  const now = new Date();
  const { body, rows, counts } = await buildBackup(trigger, now);
  const pathname = `${BACKUP_PREFIX}${jstStamp(now)}_${trigger}.json.gz`;
  await put(pathname, body, {
    access: "private",
    contentType: "application/gzip",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return { pathname, size: body.length, rows, counts };
}

/** 保存期間を過ぎたバックアップを消す。消したファイル名を返す */
export async function pruneBackups(): Promise<string[]> {
  const files = await listBackups(); // 新しい順
  const limit = Date.now() - BACKUP_RETENTION_DAYS * 86_400_000;
  const old = files.slice(KEEP_AT_LEAST).filter((f) => new Date(f.uploadedAt).getTime() < limit);
  if (old.length) await del(old.map((f) => f.url));
  return old.map((f) => f.pathname);
}
