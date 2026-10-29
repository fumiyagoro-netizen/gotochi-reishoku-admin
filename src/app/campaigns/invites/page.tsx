import { redirect } from "next/navigation";
import { getCachedCurrentUser } from "@/lib/auth";
import { getCurrentRole, getPermissions } from "@/lib/role";
import { loadAnswererGroups } from "@/lib/retail";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { CampaignTabs } from "@/components/campaigns/campaign-tabs";
import { InvitesManager, type InviteRow } from "@/components/campaigns/invites-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "案内・申請URL｜流通企画" };

export default async function CampaignInvitesPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { year } = await searchParams;
  // 申請ページのURLは、知っていれば誰でもその担当者として回答できるので管理者だけ
  if (!getPermissions(await getCurrentRole()).canManageCampaigns) redirect(`/campaigns${year ? `?year=${year}` : ""}`);

  const [{ groups, openCampaigns }, user] = await Promise.all([loadAnswererGroups(), getCachedCurrentUser()]);
  const rows: InviteRow[] = groups.map((g) => ({
    email: g.email,
    name: g.name,
    companies: g.companies,
    products: g.products.map((p) => ({
      id: p.id,
      productName: p.productName,
      year: p.year,
      prizeLevel: p.prizeLevel,
      contactOverridden: p.contactOverridden,
      answererName: p.answererName,
      entryEmail: p.entryEmail,
      entryContactName: p.entryContactName,
    })),
    pairCount: g.pairCount,
    answeredCount: g.answeredCount,
    campaignNames: g.campaignNames,
    hasUrl: !!g.invite,
    lastSentAt: g.invite?.lastSentAt?.toISOString() ?? null,
    lastAnsweredAt: g.invite?.lastAnsweredAt?.toISOString() ?? null,
    suppressed: g.suppressed,
  }));

  return (
    <PageContainer>
      <PageHeader
        title="案内・申請URL"
        count={rows.length}
        countUnit="人"
        description="募集中の企画の対象商品を、回答する担当者（メールアドレス）ごとにまとめています。担当者ごとに専用の申請ページがあり、案内メールでURLを届けます。"
      />
      <CampaignTabs />
      <InvitesManager rows={rows} openCampaignNames={openCampaigns.map((c) => c.name)} myEmail={user?.email ?? ""} />
    </PageContainer>
  );
}
