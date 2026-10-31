import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentRole, getPermissions } from "@/lib/role";
import { loadCampaignRows } from "@/lib/retail";
import { formatJstDate, isAnswerable, parseAwardIds, participationState } from "@/lib/retail-shared";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KeyValue, KeyValueList } from "@/components/ui/key-value";
import { StatCard } from "@/components/ui/stat-card";
import { ChevronDown, Download, Pencil, Settings2, Store } from "@/components/ui/icons";
import { CampaignStatusBadge } from "@/components/campaigns/badges";
import { ParticipantTable } from "@/components/campaigns/participant-table";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; saved?: string }>;
}

export async function generateMetadata({ params }: Props) {
  const id = parseInt((await params).id);
  const c = Number.isInteger(id) ? await prisma.retailCampaign.findUnique({ where: { id }, select: { name: true } }) : null;
  return { title: c ? `${c.name}｜流通企画` : "流通企画" };
}

// 企画のページは見るだけ（入力欄・選択欄を置かない）。採用・見送りの変更は「採用・見送りを編集」の画面で行い、
// 保存するまで反映しない（/campaigns/[id]/decide）
export default async function CampaignDetailPage({ params, searchParams }: Props) {
  const [{ id }, { year, saved }] = await Promise.all([params, searchParams]);
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

  const by = (state: ReturnType<typeof participationState>) => rows.filter((r) => participationState(r) === state);
  const adopted = by("adopted");
  const pending = by("pending");
  const declined = by("declined");
  const no = by("no");
  const unanswered = by("none");
  const savedCount = saved && /^\d+$/.test(saved) ? Number(saved) : null;

  return (
    <PageContainer>
      <PageHeader
        title={campaign.name}
        meta={<CampaignStatusBadge status={campaign.status} />}
        backHref={`/campaigns${q}`}
        backLabel="流通企画"
        actions={
          <>
            {perms.canDownload && (
              <ButtonLink variant="secondary" external href={`/api/campaigns/${campaign.id}/export`} icon={<Download />}>
                Excel
              </ButtonLink>
            )}
            {perms.canManageCampaigns && (
              <>
                <ButtonLink variant="secondary" href={`/campaigns/${campaign.id}/edit${q}`} icon={<Settings2 />}>
                  企画の設定
                </ButtonLink>
                <ButtonLink variant="primary" href={`/campaigns/${campaign.id}/decide${q}`} icon={<Pencil />}>
                  採用・見送りを編集
                </ButtonLink>
              </>
            )}
          </>
        }
      />

      {savedCount != null && (
        <div className="mb-6">
          <Alert tone="success">採用・見送りを保存しました（{savedCount}件）</Alert>
        </div>
      )}

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

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="採用（この企画に出る）" value={adopted.length} tone={adopted.length ? "success" : "default"} />
        <StatCard label="確定待ち" value={pending.length} tone={pending.length ? "warning" : "default"} hint="企業が参加を希望" />
        <StatCard label="見送り" value={declined.length} />
        <StatCard label="参加しない" value={no.length} />
        <StatCard label="未回答" value={unanswered.length} />
      </div>

      <Section title="採用（この企画に出る商品）" count={adopted.length}>
        {adopted.length > 0 ? (
          <ParticipantTable rows={adopted} variant="adopted" yearQuery={q} />
        ) : (
          <Card>
            <EmptyState
              icon={Store}
              title="採用した商品はまだありません"
              description={
                perms.canManageCampaigns
                  ? "「採用・見送りを編集」で、参加を希望した商品などを採用にします"
                  : "事務局が採用すると、ここに表示されます"
              }
            />
          </Card>
        )}
      </Section>

      {pending.length > 0 && (
        <Section
          title="確定待ち（企業が参加を希望・事務局は未定）"
          count={pending.length}
          description={perms.canManageCampaigns ? "採用か見送りを決めるときは「採用・見送りを編集」から" : undefined}
        >
          <ParticipantTable rows={pending} variant="pending" yearQuery={q} />
        </Section>
      )}

      {declined.length + no.length > 0 && (
        <Folded title="見送り・参加しない" count={declined.length + no.length}>
          <ParticipantTable rows={[...declined, ...no]} variant="closed" yearQuery={q} />
        </Folded>
      )}

      {unanswered.length > 0 && (
        <Folded title="未回答" count={unanswered.length}>
          <ParticipantTable rows={unanswered} variant="unanswered" yearQuery={q} />
        </Folded>
      )}
    </PageContainer>
  );
}

function Section({
  title,
  count,
  description,
  children,
}: {
  title: string;
  count: number;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-ink">
        {title} <span className="font-normal text-ink-subtle tabular-nums">{count}品</span>
      </h2>
      {description && <p className="mt-0.5 text-caption text-ink-subtle">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** 普段は見なくてよい商品（見送り・参加しない・未回答）は畳んでおく */
function Folded({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <details className="group mb-6">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-4 -rotate-90 text-ink-subtle transition-transform group-open:rotate-0" aria-hidden="true" />
        {title} <span className="font-normal text-ink-subtle tabular-nums">{count}品</span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
