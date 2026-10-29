import Link from "next/link";
import { getCurrentRole, getPermissions } from "@/lib/role";
import { loadCampaignSummaries } from "@/lib/retail";
import { formatJstDate, formatJstDateTime } from "@/lib/retail-shared";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, Store } from "@/components/ui/icons";
import { CampaignTabs } from "@/components/campaigns/campaign-tabs";
import { CampaignStatusBadge } from "@/components/campaigns/badges";

export const dynamic = "force-dynamic";

export const metadata = { title: "流通企画" };

const LINK_CLASS =
  "text-accent hover:underline rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

interface Props {
  searchParams: Promise<{ year?: string }>;
}

export default async function CampaignsPage({ searchParams }: Props) {
  const { year } = await searchParams;
  const perms = getPermissions(await getCurrentRole());
  const campaigns = await loadCampaignSummaries();
  const q = year ? `?year=${year}` : "";

  return (
    <PageContainer>
      <PageHeader
        title="流通企画"
        count={campaigns.length}
        description="受賞商品を小売店・通販サイトで扱う企画ごとに、企業の参加希望と事務局の確定（採用・見送り）を記録します。"
        actions={
          perms.canManageCampaigns && (
            <ButtonLink variant="primary" href={`/campaigns/new${q}`} icon={<Plus />}>
              流通企画を追加
            </ButtonLink>
          )
        }
      />
      <CampaignTabs />

      <Table>
        <thead>
          <tr>
            <Th>企画名</Th>
            <Th>状態</Th>
            <Th>対象年度</Th>
            <Th>実施時期</Th>
            <Th>回答締切</Th>
            <Th align="right">対象</Th>
            <Th align="right">参加希望</Th>
            <Th align="right">参加しない</Th>
            <Th align="right">未回答</Th>
            <Th align="right">採用</Th>
            <Th>最終回答</Th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <Tr key={c.id}>
              <Td primary>
                <Link href={`/campaigns/${c.id}${q}`} className={LINK_CLASS}>
                  {c.name}
                </Link>
              </Td>
              <Td>
                <CampaignStatusBadge status={c.status} />
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {c.years.map((y) => (
                    <Badge key={y} tone="neutral" size="sm">
                      {y}年度
                    </Badge>
                  ))}
                </div>
              </Td>
              <Td>{c.period || "—"}</Td>
              <Td nowrap className="tabular-nums">{c.deadline ? formatJstDate(c.deadline) : "—"}</Td>
              <Td numeric>{c.targetCount}</Td>
              <Td numeric>{c.yes}</Td>
              <Td numeric>{c.no}</Td>
              <Td numeric>{c.unanswered}</Td>
              <Td numeric tone="ink" className="font-medium">{c.adopted}</Td>
              <Td nowrap className="tabular-nums">{c.lastRespondedAt ? formatJstDateTime(c.lastRespondedAt) : "—"}</Td>
            </Tr>
          ))}
          {campaigns.length === 0 && (
            <EmptyState
              colSpan={11}
              icon={Store}
              title="流通企画はまだありません"
              description={
                perms.canManageCampaigns
                  ? "「流通企画を追加」から、松屋銀座・楽天マートなどの企画を登録します"
                  : "管理者が企画を登録すると、ここに表示されます"
              }
            />
          )}
        </tbody>
      </Table>
    </PageContainer>
  );
}
