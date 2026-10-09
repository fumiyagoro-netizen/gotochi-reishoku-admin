import { NextRequest, NextResponse } from "next/server";
import { createBackup, hasBackupToday, pruneBackups } from "@/lib/backup";
import { sendAlert } from "@/lib/alert";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 毎日のバックアップ（vercel.json の crons から日本時間の深夜に呼ばれる）。
 * Vercel は環境変数 CRON_SECRET を Authorization: Bearer で付けて呼ぶので、それが一致するときだけ動く。
 * その日の分がもうあれば何もしない（呼ばれすぎても増えない）。失敗したら障害の通知メールを送る。
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    if (await hasBackupToday()) {
      return NextResponse.json({ ok: true, skipped: "already backed up today" });
    }
    const result = await createBackup("cron");
    const pruned = await pruneBackups();
    return NextResponse.json({ ok: true, ...result, pruned });
  } catch (error) {
    await sendAlert("毎日のバックアップに失敗しました", [
      "データベースの自動バックアップが失敗しました。",
      "管理画面の「設定」→「バックアップ」から手動で取り直せるか確認してください。",
      "",
      `内容: ${error instanceof Error ? error.message : String(error)}`.slice(0, 600),
    ]);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
