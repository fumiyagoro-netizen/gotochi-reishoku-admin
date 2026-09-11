import { redirect } from "next/navigation";
import { getCurrentRole, getPermissions } from "@/lib/role";

// サイト管理（/site 配下）は canManageSite の役割だけ（当面は管理者のみ）。
// ページごとではなくここで一括して止める。/api/site/* はレイアウトを通らないので、
// 各ルートで同じフラグを確認すること（src/lib/role-shared.ts の canManageSite の説明を参照）。
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const role = await getCurrentRole();
  if (!getPermissions(role).canManageSite) redirect("/");
  return <>{children}</>;
}
