import Link from "next/link";
import { getCurrentRole, getPermissions } from "@/lib/role";
import { loadParticipationOverview, type ParticipationRow } from "@/lib/retail";
import { formatJstDate, type ParticipationState } from "@/lib/retail-shared";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { ButtonLink } from "@/components/ui/button";
import { Badge, GrandPrixBadge, PrizeBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, Th, Td, Thumb, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { Plus, Store } from "@/components/ui/icons";
import { CampaignTabs } from "@/components/campaigns/campaign-tabs";
import { CampaignStatusBadge, ParticipationLegend, ParticipationMark } from "@/components/campaigns/badges";

export const dynamic = "force-dynamic";

export const metadata = { title: "流通企画" };

const LINK_CLASS =
  "rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

// 商品の絞り込み。既定は「採用か確定待ちがある商品」（どこにも出ない商品を並べない）
const SHOWS = {
  active: { label: "採用・確定待ちがある商品", test: (r: ParticipationRow) => r.adoptedCount > 0 || r.pendingCount > 0 },
  adopted: { label: "採用された商品だけ", test: (r: ParticipationRow) => r.adoptedCount > 0 },
  all: { label: "対象の受賞商品すべて", test: () => true },
} as const;
type Show = keyof typeof SHOWS;

interface Props {
  // year はサイドバーの年度（リンクで引き継ぐだけ）。商品の年度の絞り込みは y
  searchParams: Promise<{ year?: string; show?: string; y?: string }>;
}

export default async function CampaignsPage({ searchParams }: Props) {
  const params = await searchParams;
  const show: Show = params.show === "adopted" || params.show === "all" ? params.show : "active";
  const perms = getPermissions(await getCurrentRole());
  const { campaigns, rows } = await loadParticipationOverview();
  const q = params.year ? `?year=${params.year}` : "";

  const years = [...new Set(campaigns.flatMap((c) => c.years))].sort((a, b) => b - a);
  const y = years.find((v) => String(v) === params.y);
  const yearRows = y ? rows.filter((r) => r.year === y) : rows;
  const visible = yearRows.filter(SHOWS[show].test);
  // 年度で絞ったときは、その年度を対象にしていない企画の列を出さない（記録が残っている列は出す）
  const columns = y
    ? campaigns.filter((c) => c.years.includes(y) || visible.some((r) => r.cells[c.id].state !== "outside"))
    : campaigns;

  const href = (next: { show?: Show; y?: number }) => {
    const sp = new URLSearchParams();
    if (params.year) sp.set("year", params.year);
    if (next.show && next.show !== "active") sp.set("show", next.show);
    if (next.y) sp.set("y", String(next.y));
    const s = sp.toString();
    return `/campaigns${s ? `?${s}` : ""}`;
  };
  const countOf = (campaignId: number, state: ParticipationState) =>
    rows.filter((r) => r.cells[campaignId].state === state).length;

  return (
    <PageContainer>
      <PageHeader
        title="流通企画"
        description="どの受賞商品がどの企画に出るか（事務局が採用したもの）を一覧で見られます。企画名を押すと、その企画の参加商品を確認できます。"
        actions={
          perms.canManageCampaigns && (
            <ButtonLink variant="primary" href={`/campaigns/new${q}`} icon={<Plus />}>
              流通企画を追加
            </ButtonLink>
          )
        }
      />
      <CampaignTabs />

      {campaigns.length === 0 ? (
        <Card>
          <EmptyState
            icon={Store}
            title="流通企画はまだありません"
            description={
              perms.canManageCampaigns
                ? "「流通企画を追加」から、松屋銀座・楽天マートなどの企画を登録します"
                : "管理者が企画を登録すると、ここに表示されます"
            }
          />
        </Card>
      ) : (
        <>
          {/* 企画ごとの件数 */}
          <section aria-labelledby="campaigns-heading" className="mb-8">
            <h2 id="campaigns-heading" className="mb-3 text-sm font-semibold text-ink">
              企画 <span className="font-normal text-ink-subtle tabular-nums">{campaigns.length}件</span>
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {campaigns.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/campaigns/${c.id}${q}`}
                    className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <Card
                      padding="sm"
                      className="h-full transition-colors group-hover:border-line-strong group-hover:bg-surface-muted/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-ink group-hover:underline">{c.name}</p>
                        <CampaignStatusBadge status={c.status} />
                      </div>
                      <p className="mt-1 text-caption text-ink-subtle">
                        {c.years.map((v) => `${v}年度`).join("・")}の受賞商品
                        {c.period && <> ／ {c.period}</>}
                        {c.deadline && <> ／ 回答締切 {formatJstDate(c.deadline)}</>}
                      </p>
                      <dl className="mt-3 flex items-end gap-5">
                        <div>
                          <dt className="text-caption text-ink-subtle">採用</dt>
                          <dd
                            className={`text-2xl font-semibold tabular-nums ${countOf(c.id, "adopted") ? "text-emerald-700" : "text-ink-subtle"}`}
                          >
                            {countOf(c.id, "adopted")}
                            <span className="ml-0.5 text-sm font-normal">品</span>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-caption text-ink-subtle">確定待ち</dt>
                          <dd className="text-lg font-semibold tabular-nums text-ink">{countOf(c.id, "pending")}</dd>
                        </div>
                        <div>
                          <dt className="text-caption text-ink-subtle">未回答</dt>
                          <dd className="text-lg font-semibold tabular-nums text-ink-muted">{countOf(c.id, "none")}</dd>
                        </div>
                      </dl>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* 商品 × 企画 */}
          <section aria-labelledby="products-heading">
            <h2 id="products-heading" className="mb-3 text-sm font-semibold text-ink">
              商品ごとの参加状況 <span className="font-normal text-ink-subtle tabular-nums">{visible.length}品</span>
            </h2>
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {(Object.keys(SHOWS) as Show[]).map((key) => (
                <FilterChip key={key} href={href({ show: key, y })} active={show === key} count={yearRows.filter(SHOWS[key].test).length}>
                  {SHOWS[key].label}
                </FilterChip>
              ))}
              {years.length > 1 && (
                <>
                  <span aria-hidden="true" className="mx-1.5 h-5 w-px bg-line" />
                  <FilterChip href={href({ show })} active={!y}>
                    すべての年度
                  </FilterChip>
                  {years.map((v) => (
                    <FilterChip key={v} href={href({ show, y: v })} active={y === v}>
                      {v}年度
                    </FilterChip>
                  ))}
                </>
              )}
            </div>
            <div className="mb-3">
              <ParticipationLegend />
            </div>

            <Table>
              <thead>
                <tr>
                  <Th>商品</Th>
                  {columns.map((c) => (
                    <Th key={c.id} align="center" className="py-2 align-bottom">
                      {/* 見出しの既定は折り返さないので、長い企画名はこの幅の中で折り返す */}
                      <span className="mx-auto block w-28 whitespace-normal leading-snug">
                        <Link href={`/campaigns/${c.id}${q}`} className={`text-ink ${LINK_CLASS}`}>
                          {c.name}
                        </Link>
                      </span>
                      <span className="mt-1 block font-normal tabular-nums">採用 {countOf(c.id, "adopted")}品</span>
                    </Th>
                  ))}
                  <Th align="right">採用された企画</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Thumb src={r.mainImageId ? `/api/images/${r.mainImageId}` : undefined} alt="" />
                        <div className="min-w-0">
                          <Link href={`/entries/${r.id}${q}`} className={`font-medium text-ink ${LINK_CLASS}`}>
                            {r.productName}
                          </Link>
                          <p className="text-caption text-ink-subtle">{r.companyName}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            <Badge tone="neutral" size="sm">{r.year}年度</Badge>
                            {r.prizeLevel && <PrizeBadge prizeLevel={r.prizeLevel} size="sm" />}
                            {r.grandPrix && <GrandPrixBadge size="sm" />}
                          </div>
                        </div>
                      </div>
                    </Td>
                    {columns.map((c) => {
                      const cell = r.cells[c.id];
                      return (
                        <Td key={c.id} className={cellClass(cell.state)}>
                          <ParticipationMark state={cell.state} conflict={cell.conflict} />
                        </Td>
                      );
                    })}
                    <Td numeric tone="ink" className="font-medium">
                      {r.adoptedCount > 0 ? `${r.adoptedCount}企画` : <span className="text-ink-faint">—</span>}
                    </Td>
                  </Tr>
                ))}
                {visible.length === 0 && (
                  <EmptyState
                    colSpan={columns.length + 2}
                    icon={Store}
                    title={show === "adopted" ? "採用された商品はまだありません" : "該当する商品はありません"}
                    description={
                      show === "all"
                        ? undefined
                        : "「対象の受賞商品すべて」を選ぶと、まだ回答の無い商品も表示します"
                    }
                  />
                )}
              </tbody>
            </Table>
          </section>
        </>
      )}
    </PageContainer>
  );
}

// 採用のセルだけ薄く塗り、行を横に見たときにどこへ出るかが目に入るようにする
function cellClass(state: ParticipationState): string {
  if (state === "adopted") return "bg-emerald-50/70 text-center";
  if (state === "outside") return "bg-surface-muted/50 text-center";
  return "text-center";
}
