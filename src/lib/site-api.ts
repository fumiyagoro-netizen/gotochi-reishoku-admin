import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { getRoleFromRequest, getPermissions } from "./role";
import { getUserFromRequest } from "./auth";
import { writeAuditLog } from "./audit";

/**
 * /api/site/* の共通処理（サーバー専用）。
 * /site のページは src/app/site/layout.tsx で止めているが、API はレイアウトを通らないので各ルートで必ず呼ぶ。
 */

/** サイト管理（canManageSite）でなければ 403 のレスポンスを返す。使えるなら null */
export async function denyUnlessSiteManager(request: Request): Promise<NextResponse | null> {
  const role = await getRoleFromRequest(request);
  if (getPermissions(role).canManageSite) return null;
  return NextResponse.json({ success: false, message: "サイト管理の権限がありません" }, { status: 403 });
}

export async function siteAuditLog(request: Request, target: string, targetId: string | number, detail: string) {
  const user = await getUserFromRequest(request);
  await writeAuditLog({
    userId: user?.userId,
    userEmail: user?.email,
    action: "site",
    target,
    targetId: String(targetId),
    detail,
  });
}

/**
 * サイト用に保存した画像・PDF の URL か。公開ページに出すので public の Blob に置く（/api/site/upload）。
 * 任意の URL を保存させない（別サイトの画像を載せる・既存のファイルを消させる）ため、ホストと site/ 配下を確認する。
 */
export function isSiteAssetUrl(url: unknown): url is string {
  if (typeof url !== "string" || !url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com") && u.pathname.startsWith("/site/");
  } catch {
    return false;
  }
}

/** 使わなくなったサイト用ファイルを消す（差し替え・削除のとき）。失敗しても保存は止めない */
export async function deleteSiteAssets(urls: unknown[]) {
  const targets = urls.filter(isSiteAssetUrl);
  if (targets.length === 0) return;
  await del(targets).catch((e) => console.error("Failed to delete site assets:", e));
}
