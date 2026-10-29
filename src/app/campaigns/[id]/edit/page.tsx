import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentRole, getPermissions } from "@/lib/role";
import { loadAwardChoices } from "@/lib/retail-awards";
import { isCampaignStatus, parseAwardIds } from "@/lib/retail-shared";
import { utcToJstDateInputValue } from "@/lib/award-dates";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { CampaignForm } from "@/components/campaigns/campaign-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "流通企画の編集" };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}

export default async function EditCampaignPage({ params, searchParams }: Props) {
  const [{ id }, { year }] = await Promise.all([params, searchParams]);
  const q = year ? `?year=${year}` : "";
  const campaignId = parseInt(id);
  if (!getPermissions(await getCurrentRole()).canManageCampaigns) redirect(`/campaigns/${campaignId}${q}`);

  const campaign = Number.isInteger(campaignId)
    ? await prisma.retailCampaign.findUnique({ where: { id: campaignId } })
    : null;
  if (!campaign) notFound();

  const [awards, recordCount] = await Promise.all([
    loadAwardChoices(),
    prisma.retailCampaignItem.count({ where: { campaignId } }),
  ]);

  return (
    <PageContainer width="form">
      <PageHeader title="流通企画の編集" backHref={`/campaigns/${campaignId}${q}`} backLabel={campaign.name} />
      <CampaignForm
        campaignId={campaignId}
        awards={awards}
        recordCount={recordCount}
        yearQuery={q}
        initial={{
          name: campaign.name,
          awardIds: parseAwardIds(campaign.awardIds),
          status: isCampaignStatus(campaign.status) ? campaign.status : "draft",
          period: campaign.period,
          deadline: utcToJstDateInputValue(campaign.deadline),
          description: campaign.description,
          memo: campaign.memo,
        }}
      />
    </PageContainer>
  );
}
