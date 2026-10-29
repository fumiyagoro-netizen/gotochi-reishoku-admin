import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentRole, getPermissions } from "@/lib/role";
import { loadCampaignRows } from "@/lib/retail";
import { formatJstDate, isAnswerable, parseAwardIds } from "@/lib/retail-shared";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { KeyValue, KeyValueList } from "@/components/ui/key-value";
import { Pencil } from "@/components/ui/icons";
import { CampaignStatusBadge } from "@/components/campaigns/badges";
import { CampaignItemsTable } from "@/components/campaigns/campaign-items-table";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}

export async function generateMetadata({ params }: Props) {
  const id = parseInt((await params).id);
  const c = Number.isInteger(id) ? await prisma.retailCampaign.findUnique({ where: { id }, select: { name: true } }) : null;
  return { title: c ? `${c.name}｜流通企画` : "流通企画" };
}

export default async function CampaignDetailPage({ params, searchParams }: Props) {
  const [{ id }, { year }] = await Promise.all([params, searchParams]);
  const q = year ? `?year=${year}` : "";
  const campaignId = parseInt(id);
  const campaign = Number.isInteger(campaignId)
    ? await prisma.retailCampaign.findUnique({ where: { id: campaignId } })
    : null;
  if (!campaign) notFound();

  const perms = getPermissions(await getCurrentRole());
  const awardIds = parseAwardIds(campaign.awardIds);
  const [rows, awards] = await Promise.all([
    loadCampaignRows(campaign),
    prisma.award.findMany({ where: { id: { in: awardIds } }, orderBy: { year: "desc" }, select: { year: true } }),
  ]);
  const deadlinePassed = campaign.status === "open" && !isAnswerable(campaign);

  return (
    <PageContainer>
      <PageHeader
        title={campaign.name}
        meta={<CampaignStatusBadge status={campaign.status} />}
        backHref={`/campaigns${q}`}
        backLabel="流通企画"
        actions={
          perms.canManageCampaigns && (
            <ButtonLink variant="secondary" href={`/campaigns/${campaign.id}/edit${q}`} icon={<Pencil />}>
              企画を編集
            </ButtonLink>
          )
        }
      />

      <Card className="mb-6">
        <KeyValueList>
          <KeyValue label="対象年度">
            <span className="inline-flex flex-wrap gap-1">
              {awards.map((a) => (
                <Badge key={a.year} tone="neutral" size="sm">
                  {a.year}年度の受賞商品
                </Badge>
              ))}
            </span>
          </KeyValue>
          <KeyValue label="実施時期">{campaign.period || "—"}</KeyValue>
          <KeyValue label="回答締切">
            {campaign.deadline ? formatJstDate(campaign.deadline) : "なし"}
            {deadlinePassed && (
              <Badge tone="warning" size="sm" className="ml-2">
                締切を過ぎています（申請ページでは回答を変えられません）
              </Badge>
            )}
          </KeyValue>
          {campaign.description && (
            <KeyValue label="企業向けの説明">
              <span className="whitespace-pre-wrap">{campaign.description}</span>
            </KeyValue>
          )}
          {campaign.memo && (
            <KeyValue label="事務局メモ">
              <span className="whitespace-pre-wrap">{campaign.memo}</span>
            </KeyValue>
          )}
        </KeyValueList>
      </Card>

      <CampaignItemsTable
        campaignId={campaign.id}
        rows={rows}
        canManage={perms.canManageCampaigns}
        canDownload={perms.canDownload}
        yearQuery={q}
      />
    </PageContainer>
  );
}
