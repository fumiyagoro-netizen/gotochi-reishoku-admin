import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getRoleFromRequest } from "@/lib/role";
import { writeAuditLog } from "@/lib/audit";
import { BACKUP_RETENTION_DAYS, createBackup, listBackups, pruneBackups } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** バックアップの一覧（管理者のみ。設定画面の「バックアップ」） */
export async function GET(request: NextRequest) {
  if ((await getRoleFromRequest(request)) !== "admin") {
    return NextResponse.json({ success: false, message: "権限がありません" }, { status: 403 });
  }
  try {
    const files = await listBackups();
    return NextResponse.json({
      success: true,
      retentionDays: BACKUP_RETENTION_DAYS,
      files: files.map(({ pathname, size, uploadedAt }) => ({ pathname, size, uploadedAt })),
    });
  } catch (error) {
    console.error("List backups error:", error);
    return NextResponse.json({ success: false, message: "バックアップの一覧を読めませんでした" }, { status: 500 });
  }
}

/** 今すぐバックアップを取る（管理者のみ） */
export async function POST(request: NextRequest) {
  if ((await getRoleFromRequest(request)) !== "admin") {
    return NextResponse.json({ success: false, message: "権限がありません" }, { status: 403 });
  }
  try {
    const result = await createBackup("manual");
    await pruneBackups();
    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "create",
      target: "backup",
      targetId: result.pathname,
      detail: `手動バックアップ（${result.rows}行）`,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Create backup error:", error);
    return NextResponse.json({ success: false, message: "バックアップに失敗しました" }, { status: 500 });
  }
}
