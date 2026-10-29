import { redirect } from "next/navigation";
import { getCurrentRole, getPermissions } from "@/lib/role";

// 流通企画（/campaigns 配下）は canViewCampaigns の役割だけ（管理者・代表者・編集者）。
// 登録・編集・案内の画面は各ページで canManageCampaigns も確認する。/api/campaigns/* は
// レイアウトを通らないので、各ルートで同じフラグを確認すること（src/lib/role-shared.ts）。
export default async function CampaignsLayout({ children }: { children: React.ReactNode }) {
  const role = await getCurrentRole();
  if (!getPermissions(role).canViewCampaigns) redirect("/");
  return <>{children}</>;
}
