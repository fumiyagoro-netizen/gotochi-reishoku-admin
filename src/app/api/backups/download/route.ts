import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getUserFromRequest } from "@/lib/auth";
import { getRoleFromRequest } from "@/lib/role";
import { writeAuditLog } from "@/lib/audit";
import { BACKUP_PREFIX, listBackups } from "@/lib/backup";

export const dynamic = "force-dynamic";

/**
 * バックアップファイルのダウンロード（管理者のみ）。個人情報を含む全データなので、誰がいつ取ったかを操作ログに残す。
 * ?p= には一覧に出ているファイル名（backups/db/…）だけを受け付ける。
 */
export async function GET(request: NextRequest) {
  if ((await getRoleFromRequest(request)) !== "admin") {
    return NextResponse.json({ success: false, message: "権限がありません" }, { status: 403 });
  }
  const pathname = request.nextUrl.searchParams.get("p") ?? "";
  if (!pathname.startsWith(BACKUP_PREFIX)) {
    return NextResponse.json({ success: false, message: "見つかりません" }, { status: 404 });
  }
  const file = (await listBackups()).find((f) => f.pathname === pathname);
  if (!file) {
    return NextResponse.json({ success: false, message: "見つかりません" }, { status: 404 });
  }
  const result = await get(file.url, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return NextResponse.json({ success: false, message: "見つかりません" }, { status: 404 });
  }
  const user = await getUserFromRequest(request);
  await writeAuditLog({
    userId: user?.userId,
    userEmail: user?.email,
    action: "download",
    target: "backup",
    targetId: pathname,
    detail: "バックアップのダウンロード",
  });
  const name = pathname.slice(BACKUP_PREFIX.length);
  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="gotouchi-${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
