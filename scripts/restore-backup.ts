/**
 * バックアップ（管理画面の「設定」→「バックアップ」でダウンロードした .json.gz）を、
 * 空の新しいデータベースに戻すスクリプト。今使っているデータベースには上書きしない。
 *
 * 手順:
 *   1. Neon で新しいデータベース（またはブランチ）を作り、その接続文字列を控える
 *   2. テーブルを作る:   DATABASE_URL="<新しい接続文字列>" npx prisma db push --skip-generate
 *   3. データを戻す:     RESTORE_DATABASE_URL="<新しい接続文字列>" npx tsx scripts/restore-backup.ts <ファイル.json.gz>
 *   4. 中身を確かめてから、Vercel の DATABASE_URL を新しい接続文字列に切り替える
 *
 * 安全のため、戻し先に1行でもデータがあると止まる。.env の DATABASE_URL と同じ接続先にも戻さない。
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Prisma, PrismaClient } from "@prisma/client";

const FORMAT = 1;
const CHUNK = 500;

type Model = (typeof Prisma.dmmf.datamodel.models)[number];
type Delegate = {
  count: () => Promise<number>;
  createMany: (args: { data: unknown[] }) => Promise<{ count: number }>;
};

function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/** 参照される側のテーブルを先に入れる順番（Award → Entry → EntryImage …） */
function insertOrder(models: readonly Model[]): Model[] {
  const byName = new Map(models.map((m) => [m.name, m]));
  const done = new Set<string>();
  const order: Model[] = [];
  const visit = (m: Model, path: Set<string>) => {
    if (done.has(m.name)) return;
    if (path.has(m.name)) throw new Error(`テーブルの参照が循環しています: ${[...path, m.name].join(" → ")}`);
    path.add(m.name);
    for (const f of m.fields) {
      if (f.kind === "object" && f.relationFromFields?.length && f.type !== m.name) {
        const dep = byName.get(f.type);
        if (dep) visit(dep, path);
      }
    }
    path.delete(m.name);
    done.add(m.name);
    order.push(m);
  };
  for (const m of models) visit(m, new Set());
  return order;
}

/** JSON にしたときに文字列になった日時を Date に、空の JSON 列を DbNull に戻す */
function reviveRow(model: Model, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of model.fields) {
    if (f.kind === "object" || !(f.name in row)) continue;
    const v = row[f.name];
    if (f.type === "DateTime" && typeof v === "string") out[f.name] = new Date(v);
    else if (f.type === "Json" && v === null) out[f.name] = Prisma.DbNull;
    else out[f.name] = v;
  }
  return out;
}

async function main() {
  const file = process.argv[2];
  const target = process.env.RESTORE_DATABASE_URL;
  if (!file || !target) {
    console.error('使い方: RESTORE_DATABASE_URL="<戻し先>" npx tsx scripts/restore-backup.ts <バックアップ.json.gz>');
    process.exit(1);
  }
  if (process.env.DATABASE_URL && target.trim() === process.env.DATABASE_URL.trim()) {
    console.error("戻し先が今のデータベース（DATABASE_URL）と同じです。新しい空のデータベースを指定してください。");
    process.exit(1);
  }

  const backup = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as {
    format: number;
    createdAt: string;
    counts: Record<string, number>;
    tables: Record<string, Record<string, unknown>[]>;
  };
  if (backup.format !== FORMAT) {
    console.error(`このスクリプトが読めない形式です（format ${backup.format}）。`);
    process.exit(1);
  }
  console.log(`バックアップ: ${backup.createdAt} に作成`);

  const prisma = new PrismaClient({ datasourceUrl: target });
  const db = prisma as unknown as Record<string, Delegate>;
  const models = insertOrder(Prisma.dmmf.datamodel.models);

  try {
    // 戻し先が空であることを確かめる
    for (const m of models) {
      const n = await db[delegateName(m.name)].count();
      if (n > 0) {
        console.error(`戻し先の ${m.name} に ${n} 行あります。空のデータベースを指定してください。`);
        process.exit(1);
      }
    }

    for (const m of models) {
      const rows = (backup.tables[m.name] ?? []).map((r) => reviveRow(m, r));
      for (let i = 0; i < rows.length; i += CHUNK) {
        await db[delegateName(m.name)].createMany({ data: rows.slice(i, i + CHUNK) });
      }
      console.log(`${m.name.padEnd(24)} ${String(rows.length).padStart(6)} 行`);
    }

    // 自動で振られる番号（id）を、戻したデータの続きから振られるようにする
    for (const m of models) {
      const id = m.fields.find((f) => f.name === "id");
      const auto = id?.default && typeof id.default === "object" && "name" in id.default && id.default.name === "autoincrement";
      if (!auto) continue;
      await prisma.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${m.name}"', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM "${m.name}"`,
      );
    }

    // 件数が合っているか
    let ok = true;
    for (const m of models) {
      const n = await db[delegateName(m.name)].count();
      const expected = backup.counts[m.name] ?? 0;
      if (n !== expected) {
        ok = false;
        console.error(`件数が合いません: ${m.name} ${n} 行（バックアップは ${expected} 行）`);
      }
    }
    console.log(ok ? "完了：すべてのテーブルの件数がバックアップと一致しました。" : "件数が合わないテーブルがあります。");
    if (!ok) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
