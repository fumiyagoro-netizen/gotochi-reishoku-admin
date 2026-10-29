import { redirect } from "next/navigation";
import { getCurrentRole, getPermissions } from "@/lib/role";
import { loadAwardChoices } from "@/lib/retail-awards";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { CampaignForm } from "@/components/campaigns/campaign-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "流通企画を追加" };

export default async function NewCampaignPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { year } = await searchParams;
  const q = year ? `?year=${year}` : "";
  if (!getPermissions(await getCurrentRole()).canManageCampaigns) redirect(`/campaigns${q}`);

  const awards = await loadAwardChoices();
  // 初期値は受賞商品がある一番新しい年度
  const latest = awards.find((a) => a.winners > 0);

  return (
    <PageContainer width="form">
      <PageHeader title="流通企画を追加" backHref={`/campaigns${q}`} backLabel="流通企画" />
      <CampaignForm
        awards={awards}
        yearQuery={q}
        initial={{
          name: "",
          awardIds: latest ? [latest.id] : [],
          status: "draft",
          period: "",
          deadline: "",
          description: "",
          memo: "",
        }}
      />
    </PageContainer>
  );
}
