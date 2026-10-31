import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentRole, getPermissions } from "@/lib/role";
import { loadCampaignRows } from "@/lib/retail";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DecisionEditor } from "@/components/campaigns/decision-editor";

export const dynamic = "force-dynamic";

export const metadata = { title: "採用・見送りの編集｜流通企画" };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}

// 採用・見送りの編集（管理者のみ）。企画のページ（見るだけ）から「採用・見送りを編集」で開く
export default async function DecideCampaignPage({ params, searchParams }: Props) {
  const [{ id }, { year }] = await Promise.all([params, searchParams]);
  const q = year ? `?year=${year}` : "";
  const campaignId = parseInt(id);
  if (!getPermissions(await getCurrentRole()).canManageCampaigns) redirect(`/campaigns/${campaignId}${q}`);

  const campaign = Number.isInteger(campaignId)
    ? await prisma.retailCampaign.findUnique({ where: { id: campaignId } })
    : null;
  if (!campaign) notFound();
  const rows = await loadCampaignRows(campaign);

  return (
    <PageContainer>
      <PageHeader
        title="採用・見送りの編集"
        meta={<Badge tone="warning">編集中</Badge>}
        description={campaign.name}
        backHref={`/campaigns/${campaignId}${q}`}
        backLabel="企画のページに戻る"
      />
      <div className="mb-6">
        <Alert tone="info" title="「保存する」を押すまで反映されません">
          商品ごとに「採用」「見送り」を選ぶか、チェックを付けてまとめて選び、いちばん下の「保存する」を押してください。保存の前に、変更する内容を一覧で確認できます。
        </Alert>
      </div>
      <DecisionEditor campaignId={campaignId} campaignName={campaign.name} rows={rows} yearQuery={q} />
    </PageContainer>
  );
}
