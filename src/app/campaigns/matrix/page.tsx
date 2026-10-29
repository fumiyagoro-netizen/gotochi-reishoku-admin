import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { resolveAwardId, resolveAwardYear } from "@/lib/award";
import { loadWinnerProducts } from "@/lib/retail";
import { parseAwardIds } from "@/lib/retail-shared";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Badge, GrandPrixBadge, PrizeBadge } from "@/components/ui/badge";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip, FilterChipGroup } from "@/components/ui/filter-chip";
import { Store, TriangleAlert } from "@/components/ui/icons";
import { CampaignTabs } from "@/components/campaigns/campaign-tabs";
import { CampaignStatusBadge, DecisionBadge, ResponseBadge } from "@/components/campaigns/badges";

export const dynamic = "force-dynamic";

export const metadata = { title: "商品×企画の表｜流通企画" };

interface Props {
  searchParams: Promise<{ year?: string; only?: string }>;
}

// 行＝その年度の受賞商品、列＝その年度を対象にした企画。セルは事務局の確定を優先し、
// 未定なら企業の回答を出す（採用・見送り → 参加希望・参加しない → 未回答は「—」）
function Cell({ response, decision }: { response: string; decision: string }) {
  // 採用のあとに企業が「参加しない」に変えたものは、採用のまま見落とさないよう印を付ける
  if (decision === "adopted" && response === "no") {
    return (
      <span className="inline-flex items-center gap-1" title="企業の回答は「参加しない」です">
        <DecisionBadge decision={decision} size="sm" />
        <TriangleAlert className="size-3.5 text-warning-ink" aria-label="企業の回答は「参加しない」" />
      </span>
    );
  }
  if (decision) return <DecisionBadge decision={decision} size="sm" />;
  if (response) return <ResponseBadge response={response} size="sm" />;
  return <span className="text-ink-faint">—</span>;
}

export default async function CampaignMatrixPage({ searchParams }: Props) {
  const params = await searchParams;
  const [awardId, year] = await Promise.all([resolveAwardId(params.year), resolveAwardYear(params.year)]);
  const only = params.only === "1";
  const yq = year ? `year=${year}` : "";

  const allCampaigns = await prisma.retailCampaign.findMany({ orderBy: { id: "asc" } });
  const campaigns = allCampaigns.filter((c) => awardId && parseAwardIds(c.awardIds).includes(awardId));
  const products = awardId ? await loadWinnerProducts([awardId]) : [];
  const items = campaigns.length && products.length
    ? await prisma.retailCampaignItem.findMany({
        where: { campaignId: { in: campaigns.map((c) => c.id) }, entryId: { in: products.map((p) => p.id) } },
        select: { campaignId: true, entryId: true, response: true, decision: true },
      })
    : [];
  const itemOf = new Map(items.map((i) => [`${i.campaignId}:${i.entryId}`, i]));
  const hasAny = (entryId: number) =>
    campaigns.some((c) => {
      const i = itemOf.get(`${c.id}:${entryId}`);
      return i && (i.response === "yes" || i.decision === "adopted");
    });
  const rows = only ? products.filter((p) => hasAny(p.id)) : products;
  const count = (campaignId: number, test: (i: { response: string; decision: string }) => boolean) =>
    items.filter((i) => i.campaignId === campaignId && test(i)).length;

  return (
    <PageContainer>
      <PageHeader
        title="商品×企画の表"
        meta={year && <Badge tone="neutral">{year}年度</Badge>}
        count={rows.length}
        countUnit="品"
        description="サイドバーで選んだ年度の受賞商品が、どの企画に参加しているかを一覧で見られます。"
      />
      <CampaignTabs />

      {campaigns.length > 0 && (
        <FilterChipGroup>
            <FilterChip href={`/campaigns/matrix${yq ? `?${yq}` : ""}`} active={!only}>
              すべての受賞商品
            </FilterChip>
            <FilterChip href={`/campaigns/matrix?${yq ? `${yq}&` : ""}only=1`} active={only}>
              参加希望か採用がある商品だけ
            </FilterChip>
        </FilterChipGroup>
      )}

      <Table>
        <thead>
          <tr>
            <Th>商品</Th>
            {campaigns.map((c) => (
              <Th key={c.id} align="center">
                <Link
                  href={`/campaigns/${c.id}${yq ? `?${yq}` : ""}`}
                  className="text-ink hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  {c.name}
                </Link>
                <div className="mt-0.5 font-normal">
                  <CampaignStatusBadge status={c.status} />
                </div>
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {campaigns.length > 0 && (
            <Tr className="bg-surface-muted/40">
              <Td subtle className="text-caption">採用 ／ 参加希望</Td>
              {campaigns.map((c) => (
                <Td key={c.id} numeric className="text-center text-caption">
                  <span className="font-semibold text-ink">{count(c.id, (i) => i.decision === "adopted")}</span>
                  {" ／ "}
                  {count(c.id, (i) => i.response === "yes")}
                </Td>
              ))}
            </Tr>
          )}
          {campaigns.length > 0 &&
            rows.map((p) => (
              <Tr key={p.id}>
                <Td>
                  <Link
                    href={`/entries/${p.id}${yq ? `?${yq}` : ""}`}
                    className="font-medium text-ink hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    {p.productName}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    <PrizeBadge prizeLevel={p.prizeLevel} size="sm" />
                    {p.grandPrix && <GrandPrixBadge size="sm" />}
                    <span className="text-caption text-ink-subtle">{p.companyName}</span>
                  </div>
                </Td>
                {campaigns.map((c) => {
                  const i = itemOf.get(`${c.id}:${p.id}`);
                  return (
                    <Td key={c.id} className="text-center">
                      <Cell response={i?.response ?? ""} decision={i?.decision ?? ""} />
                    </Td>
                  );
                })}
              </Tr>
            ))}
          {(campaigns.length === 0 || rows.length === 0) && (
            <EmptyState
              colSpan={campaigns.length + 1}
              icon={Store}
              title={
                campaigns.length === 0
                  ? `${year ?? ""}年度の受賞商品を対象にした企画はありません`
                  : only
                    ? "参加希望か採用がある商品はまだありません"
                    : "この年度の受賞商品はありません"
              }
              description={
                campaigns.length === 0 ? "サイドバーで別の年度を選ぶか、企画一覧で企画の対象年度を確認してください" : undefined
              }
            />
          )}
        </tbody>
      </Table>
      {campaigns.length > 0 && (
        <p className="mt-3 text-caption text-ink-subtle">
          セルは事務局の確定（採用・見送り）を優先して表示し、未定のときは企業の回答（参加希望・参加しない）を表示します。「—」は未回答です。採用の横の三角印は、採用のあとに企業が「参加しない」と答えたものです。
        </p>
      )}
    </PageContainer>
  );
}
