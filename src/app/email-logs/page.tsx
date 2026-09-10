import { prisma } from "@/lib/prisma";
import { getCurrentRole } from "@/lib/role";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Prisma, EmailLog } from "@prisma/client";
import { jstDateStringToStartOfDayUtc, utcToJstDateInputValue } from "@/lib/award-dates";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { FilterChip, FilterChipGroup } from "@/components/ui/filter-chip";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { MailCheck } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export const metadata = { title: "配信履歴" };

/**
 * 配信履歴画面。
 *
 * EmailLog は「宛先1件につき1行」で記録される。一斉配信を1件ずつ送ると、
 * 1回の配信で数十〜数百行になる（実データでは159行/132行の配信が2回だけで
 * 300行中291行を占め、件名の種類はわずか9種類）。そのため「1回の配信」を
 * 1行にまとめたサマリを既定表示にし、宛先ごとの明細はドリルダウンで見る
 * 構成にしている。
 *
 * 3つのモードを同じルート(/email-logs)のクエリパラメータで切り替える
 * （新しいルートを増やさない方がシンプルなため）:
 *   - 既定（パラメータなし）: 配信単位のサマリ一覧
 *   - ?subject=...&sentBy=...&date=YYYY-MM-DD: その配信の宛先ごとの明細
 *   - ?view=bounced: 配信をまたいだバウンス一覧（無効アドレスの棚卸し用）
 *
 * Open-tracking (email.opened / email.clicked) is deliberately out of scope
 * for this screen — see src/app/api/webhooks/resend/route.ts, which accepts
 * those events but ignores them. Only delivered / bounced / complained are
 * tracked, since open/click rates are unreliable signals (image blocking,
 * link scanners, etc.) while delivery failure is a hard fact worth acting on.
 */
type DisplayStatus =
  | "bounced"
  | "complained"
  | "delivered"
  | "pending"
  | "untracked"
  | "skipped"
  | "failed"
  | "test";

// tone は Badge の意味色。Badge に無い色（紫・藍）だけ tone="custom" ＋ 完全クラス文字列。
// dot はフィルタチップの先頭の点（チップ自体は塗り分けない）。
const STATUS_META: Record<
  DisplayStatus,
  { label: string; tone: BadgeTone; className?: string; dot: string }
> = {
  bounced: { label: "バウンス（宛先不明）", tone: "danger", dot: "bg-red-500" },
  complained: {
    label: "迷惑メール報告",
    tone: "custom",
    className: "bg-purple-50 text-purple-700 ring-purple-600/20",
    dot: "bg-purple-500",
  },
  delivered: { label: "配信済み", tone: "success", dot: "bg-emerald-500" },
  pending: { label: "結果待ち", tone: "info", dot: "bg-blue-500" },
  // Webhook (RESEND_WEBHOOK_SECRET / src/app/api/webhooks/resend) was set up
  // after these rows were sent, so messageId is "" and no delivery event
  // will ever arrive for them. Showing these as "結果待ち" would make them
  // look like they're stuck waiting forever, and counting them in the
  // reachability denominator would understate the real delivery rate — so
  // they get their own label and are excluded from that calculation
  // (see measured/measuredDelivered below).
  untracked: { label: "計測対象外", tone: "neutral", dot: "bg-zinc-400" },
  skipped: { label: "スキップ(配信停止)", tone: "outline", dot: "bg-zinc-300" },
  failed: { label: "失敗", tone: "warning", dot: "bg-orange-500" },
  test: {
    label: "テスト送信",
    tone: "custom",
    className: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
    dot: "bg-indigo-500",
  },
};

function StatusBadge({ status, children }: { status: DisplayStatus; children: ReactNode }) {
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone} className={meta.className}>
      {children}
    </Badge>
  );
}

// Order badges appear in the summary list's 内訳 cell and the detail view's
// filter chips. Bounced/complained lead so the two "needs attention"
// categories are always the first thing scanned.
const STATUS_ORDER: DisplayStatus[] = [
  "bounced",
  "complained",
  "delivered",
  "pending",
  "untracked",
  "skipped",
  "failed",
  "test",
];

// Mutually exclusive and exhaustive over every EmailLog row — every row
// falls into exactly one of these 8 buckets. Same precedence as
// deriveStatus() below (a bounce/complaint/delivery event always overrides
// the original send-time status), applied as a `where` clause so counts
// summed across all 8 buckets always equal the table's total row count.
// Reused for: the detail view's status filter, the cross-campaign bounce
// view, and the top-of-page summary counts.
const STATUS_FILTER_WHERE: Record<DisplayStatus, Prisma.EmailLogWhereInput> = {
  bounced: { bouncedAt: { not: null } },
  complained: { bouncedAt: null, complainedAt: { not: null } },
  delivered: { bouncedAt: null, complainedAt: null, deliveredAt: { not: null } },
  pending: {
    bouncedAt: null,
    complainedAt: null,
    deliveredAt: null,
    status: "sent",
    messageId: { not: "" },
  },
  untracked: {
    bouncedAt: null,
    complainedAt: null,
    deliveredAt: null,
    status: "sent",
    messageId: "",
  },
  skipped: { bouncedAt: null, complainedAt: null, deliveredAt: null, status: "skipped" },
  failed: { bouncedAt: null, complainedAt: null, deliveredAt: null, status: "failed" },
  test: { bouncedAt: null, complainedAt: null, deliveredAt: null, status: "test" },
};

function deriveStatus(
  log: Pick<EmailLog, "status" | "deliveredAt" | "bouncedAt" | "complainedAt" | "messageId">
): DisplayStatus {
  if (log.bouncedAt) return "bounced";
  if (log.complainedAt) return "complained";
  if (log.deliveredAt) return "delivered";
  if (log.status === "skipped") return "skipped";
  if (log.status === "failed") return "failed";
  if (log.status === "test") return "test";
  // status === "sent" with no webhook event yet — distinguish "still
  // waiting" from "can never be measured" by whether a messageId was ever
  // recorded (see the "untracked" comment on STATUS_META above).
  return log.messageId === "" ? "untracked" : "pending";
}

// One row per campaign (subject + sentBy + JST calendar day) rather than one
// row per recipient. Field names match the double-quoted column aliases in
// the raw query below, and the 8 DisplayStatus keys are added dynamically
// via the same alias names so STATUS_ORDER can index straight into a group.
interface CampaignGroup extends Record<DisplayStatus, number> {
  subject: string;
  sentBy: string;
  sendDate: Date;
  firstSentAt: Date;
  total: number;
  // Rows with a real messageId, i.e. sends that actually reached Resend and
  // could in principle receive a delivery webhook. The reachability rate is
  // measuredDelivered / measured — deliberately NOT total, so campaigns sent
  // before the webhook existed don't drag the rate down with sends that were
  // never going to report back either way.
  measured: number;
  measuredDelivered: number;
}

function formatReachRate(measured: number, measuredDelivered: number): string {
  if (measured === 0) return "—";
  return `${((measuredDelivered / measured) * 100).toFixed(1)}%`;
}

// Rendered on the server, which runs in UTC — without an explicit timeZone
// these would show every timestamp 9 hours behind the Japan time it actually
// happened at (same gotcha noted in src/app/logs/page.tsx).
function formatJstDateTime(date: Date): string {
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

function formatJstDate(date: Date): string {
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

const SUMMARY_PAGE_SIZE = 20;
const DETAIL_PAGE_SIZE = 50;
const BOUNCE_PAGE_SIZE = 50;

// 件名リンク（サマリ・バウンス一覧で共通）
const SUBJECT_LINK_CLASS =
  "rounded-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

interface Props {
  searchParams: Promise<{
    page?: string;
    view?: string;
    subject?: string;
    sentBy?: string;
    date?: string;
    status?: string;
  }>;
}

export default async function EmailLogsPage({ searchParams }: Props) {
  // Admin-only, like the audit log / settings / user management screens:
  // this exposes who was mailed and which addresses bounced across every
  // send, so it is not gated on canSendEmail (which representatives also
  // have) but on the role itself.
  const role = await getCurrentRole();
  if (role !== "admin") redirect("/");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));

  const dayStart =
    typeof params.date === "string" ? jstDateStringToStartOfDayUtc(params.date) : null;
  const isDetailMode = typeof params.subject === "string" && dayStart !== null;
  const isBouncedView = !isDetailMode && params.view === "bounced";

  if (isDetailMode) {
    return (
      <CampaignDetail
        subject={params.subject!}
        sentBy={params.sentBy ?? ""}
        dateParam={params.date!}
        dayStart={dayStart!}
        statusParam={params.status}
        page={page}
      />
    );
  }

  if (isBouncedView) {
    return <BouncedAcrossCampaigns page={page} />;
  }

  return <CampaignSummary page={page} />;
}

// ---------------------------------------------------------------------------
// Mode 1: campaign summary (default view)
// ---------------------------------------------------------------------------

async function CampaignSummary({ page }: { page: number }) {
  const offset = (page - 1) * SUMMARY_PAGE_SIZE;

  // Prisma's groupBy() can only group by literal columns, not by an
  // expression like "the JST calendar date of createdAt" (there is no such
  // column — createdAt is a UTC instant). Bucketing in JS instead (fetch
  // every row, group in memory) is exactly the pattern this redesign is
  // trying to get away from, since EmailLog will keep growing well past
  // today's ~300 rows. So this is a single indexed, parameterized raw query
  // that aggregates in Postgres and returns one row per campaign, not one
  // row per recipient. LIMIT/OFFSET below are passed as tagged-template
  // values, so Prisma sends them as bound query parameters, not
  // string-concatenated SQL — the same protection applies to every other
  // interpolated value in this file.
  //
  // createdAt is `timestamp without time zone` holding a UTC instant (the
  // same convention used in src/lib/entry-timestamp.ts and
  // src/lib/award-dates.ts). To bucket by JST calendar day: `AT TIME ZONE
  // 'UTC'` first reinterprets the naive timestamp as UTC (producing a
  // timestamptz), then `AT TIME ZONE 'Asia/Tokyo'` converts that instant to
  // Asia/Tokyo wall-clock time (producing a naive timestamp again), and
  // `::date` takes just the calendar date. No DST handling needed — Japan
  // Standard Time is always UTC+9.
  const groups = await prisma.$queryRaw<CampaignGroup[]>`
    SELECT
      subject,
      "sentBy",
      ((("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tokyo'))::date AS "sendDate",
      MIN("createdAt") AS "firstSentAt",
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (WHERE "bouncedAt" IS NOT NULL)::int AS "bounced",
      COUNT(*) FILTER (WHERE "bouncedAt" IS NULL AND "complainedAt" IS NOT NULL)::int AS "complained",
      COUNT(*) FILTER (WHERE "bouncedAt" IS NULL AND "complainedAt" IS NULL AND "deliveredAt" IS NOT NULL)::int AS "delivered",
      COUNT(*) FILTER (
        WHERE "bouncedAt" IS NULL AND "complainedAt" IS NULL AND "deliveredAt" IS NULL
          AND status = 'sent' AND "messageId" <> ''
      )::int AS "pending",
      COUNT(*) FILTER (
        WHERE "bouncedAt" IS NULL AND "complainedAt" IS NULL AND "deliveredAt" IS NULL
          AND status = 'sent' AND "messageId" = ''
      )::int AS "untracked",
      COUNT(*) FILTER (
        WHERE "bouncedAt" IS NULL AND "complainedAt" IS NULL AND "deliveredAt" IS NULL AND status = 'skipped'
      )::int AS "skipped",
      COUNT(*) FILTER (
        WHERE "bouncedAt" IS NULL AND "complainedAt" IS NULL AND "deliveredAt" IS NULL AND status = 'failed'
      )::int AS "failed",
      COUNT(*) FILTER (
        WHERE "bouncedAt" IS NULL AND "complainedAt" IS NULL AND "deliveredAt" IS NULL AND status = 'test'
      )::int AS "test",
      COUNT(*) FILTER (WHERE "messageId" <> '')::int AS "measured",
      COUNT(*) FILTER (
        WHERE "messageId" <> '' AND "bouncedAt" IS NULL AND "complainedAt" IS NULL AND "deliveredAt" IS NOT NULL
      )::int AS "measuredDelivered"
    FROM "EmailLog"
    GROUP BY subject, "sentBy", ((("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tokyo'))::date
    ORDER BY "firstSentAt" DESC
    LIMIT ${SUMMARY_PAGE_SIZE}
    OFFSET ${offset}
  `;

  const [totalGroupsRows, totalAll, deliveredAll, bouncedAll, complainedAll, measuredAll, measuredDeliveredAll] =
    await Promise.all([
      prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM (
          SELECT 1 FROM "EmailLog"
          GROUP BY subject, "sentBy", ((("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tokyo'))::date
        ) grouped
      `,
      prisma.emailLog.count(),
      prisma.emailLog.count({ where: STATUS_FILTER_WHERE.delivered }),
      prisma.emailLog.count({ where: STATUS_FILTER_WHERE.bounced }),
      prisma.emailLog.count({ where: STATUS_FILTER_WHERE.complained }),
      prisma.emailLog.count({ where: { messageId: { not: "" } } }),
      prisma.emailLog.count({
        where: { messageId: { not: "" }, ...STATUS_FILTER_WHERE.delivered },
      }),
    ]);

  const totalGroups = totalGroupsRows[0]?.count ?? 0;
  const totalPages = Math.ceil(totalGroups / SUMMARY_PAGE_SIZE);
  const reachRateAll = formatReachRate(measuredAll, measuredDeliveredAll);

  return (
    <PageContainer>
      <PageHeader title="配信履歴" count={totalGroups} countUnit="件の配信" />

      {/* Top summary — what the user needs to know first is "did anything fail to arrive". */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="総配信数" value={totalAll} hint="宛先単位の送信件数" />
        <StatCard label="配信済み" value={deliveredAll} tone="success" />
        <StatCard
          label="バウンス（要対応）"
          value={bouncedAll}
          href="/email-logs?view=bounced"
          tone={bouncedAll > 0 ? "danger" : "default"}
        />
        <StatCard
          label="迷惑メール報告"
          value={complainedAll}
          tone={complainedAll > 0 ? "purple" : "default"}
        />
        <StatCard
          label="到達率"
          value={reachRateAll}
          hint={measuredAll === 0 ? "計測対象なし（Webhook設定前の送信のみ）" : undefined}
        />
      </div>

      <Table>
        <thead>
          <tr>
            <Th width="w-40">送信日時</Th>
            <Th>件名</Th>
            <Th align="right" width="w-20">宛先数</Th>
            <Th width="w-24">到達率</Th>
            <Th>内訳</Th>
            <Th width="w-40">送信者</Th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            // Bounces/complaints are the whole point of this screen — a
            // tinted row background makes a bad campaign visible without
            // reading every badge.
            const rowTone = g.bounced > 0 ? "danger" : g.complained > 0 ? "purple" : undefined;
            const dateParam = utcToJstDateInputValue(g.sendDate);
            const detailHref = `/email-logs?subject=${encodeURIComponent(g.subject)}&sentBy=${encodeURIComponent(g.sentBy)}&date=${dateParam}`;
            return (
              <Tr key={`${g.subject}__${g.sentBy}__${dateParam}`} tone={rowTone}>
                <Td subtle nowrap top>
                  {formatJstDateTime(new Date(g.firstSentAt))}
                </Td>
                <Td top>
                  <Link href={detailHref} className={SUBJECT_LINK_CLASS} title={g.subject}>
                    {g.subject}
                  </Link>
                </Td>
                <Td numeric top>{g.total}</Td>
                <Td top>{formatReachRate(g.measured, g.measuredDelivered)}</Td>
                <Td top>
                  <div className="flex flex-wrap gap-1">
                    {STATUS_ORDER.filter((key) => g[key] > 0).map((key) => (
                      <StatusBadge key={key} status={key}>
                        {STATUS_META[key].label} {g[key]}
                      </StatusBadge>
                    ))}
                  </div>
                </Td>
                <Td top>{g.sentBy || "—"}</Td>
              </Tr>
            );
          })}
          {groups.length === 0 && (
            <EmptyState
              icon={MailCheck}
              title="配信履歴がありません"
              description="メール配信を行うと、配信ごとの到達状況がここに表示されます"
              colSpan={6}
            />
          )}
        </tbody>
      </Table>

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(n) => `/email-logs?page=${n}`}
        total={totalGroups}
        pageSize={SUMMARY_PAGE_SIZE}
      />
    </PageContainer>
  );
}

// ---------------------------------------------------------------------------
// Mode 2: campaign detail (drill-down into one campaign's recipients)
// ---------------------------------------------------------------------------

async function CampaignDetail({
  subject,
  sentBy,
  dateParam,
  dayStart,
  statusParam,
  page,
}: {
  subject: string;
  sentBy: string;
  dateParam: string;
  dayStart: Date;
  statusParam: string | undefined;
  page: number;
}) {
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const statusFilter: DisplayStatus | "" =
    statusParam && (STATUS_ORDER as string[]).includes(statusParam) ? (statusParam as DisplayStatus) : "";

  const where: Prisma.EmailLogWhereInput = {
    subject,
    sentBy,
    createdAt: { gte: dayStart, lt: dayEnd },
    ...(statusFilter ? STATUS_FILTER_WHERE[statusFilter] : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * DETAIL_PAGE_SIZE,
      take: DETAIL_PAGE_SIZE,
    }),
    prisma.emailLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / DETAIL_PAGE_SIZE);
  const qs = `subject=${encodeURIComponent(subject)}&sentBy=${encodeURIComponent(sentBy)}&date=${dateParam}`;

  return (
    <PageContainer>
      <PageHeader
        title={subject}
        backHref="/email-logs"
        backLabel="配信履歴に戻る"
        // 全角スペース区切りは既存の文言のまま
        description={`配信日: ${formatJstDate(dayStart)}（日本時間）　送信者: ${sentBy || "—"}　宛先: ${total}件${statusFilter ? "（絞り込み中）" : ""}`}
      />

      <FilterChipGroup>
        <FilterChip href={`/email-logs?${qs}`} active={!statusFilter}>
          すべて
        </FilterChip>
        {STATUS_ORDER.map((key) => {
          const meta = STATUS_META[key];
          return (
            <FilterChip
              key={key}
              href={`/email-logs?${qs}&status=${key}`}
              active={statusFilter === key}
              dotClassName={meta.dot}
            >
              {meta.label}
            </FilterChip>
          );
        })}
      </FilterChipGroup>

      <Table density="compact">
        <thead>
          <tr>
            <Th width="w-40">送信日時</Th>
            <Th>宛先</Th>
            <Th width="w-48">状態</Th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const derived = deriveStatus(log);
            const meta = STATUS_META[derived];
            return (
              <Tr key={log.id}>
                <Td subtle nowrap>
                  {formatJstDateTime(new Date(log.createdAt))}
                </Td>
                <Td truncate={log.toEmail}>{log.toEmail}</Td>
                <Td>
                  <StatusBadge status={derived}>{meta.label}</StatusBadge>
                  {derived === "bounced" && log.bounceReason && (
                    <p className="mt-1 max-w-xs truncate text-caption text-ink-subtle" title={log.bounceReason}>
                      {log.bounceReason}
                    </p>
                  )}
                </Td>
              </Tr>
            );
          })}
          {logs.length === 0 && (
            <EmptyState
              icon={MailCheck}
              title="該当する宛先がありません"
              description={
                statusFilter
                  ? "絞り込みを「すべて」に戻すと、この配信の全宛先が表示されます"
                  : undefined
              }
              colSpan={3}
            />
          )}
        </tbody>
      </Table>

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(n) => `/email-logs?${qs}${statusFilter ? `&status=${statusFilter}` : ""}&page=${n}`}
        total={total}
        pageSize={DETAIL_PAGE_SIZE}
      />
    </PageContainer>
  );
}

// ---------------------------------------------------------------------------
// Mode 3: bounces across every campaign (for pruning invalid addresses)
// ---------------------------------------------------------------------------

async function BouncedAcrossCampaigns({ page }: { page: number }) {
  const where = STATUS_FILTER_WHERE.bounced;

  const [logs, total] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { bouncedAt: "desc" },
      skip: (page - 1) * BOUNCE_PAGE_SIZE,
      take: BOUNCE_PAGE_SIZE,
    }),
    prisma.emailLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / BOUNCE_PAGE_SIZE);

  return (
    <PageContainer>
      <PageHeader
        title="バウンス一覧（全配信横断）"
        count={total}
        backHref="/email-logs"
        backLabel="配信履歴に戻る"
      />

      <Table>
        <thead>
          <tr>
            <Th width="w-40">送信日時</Th>
            <Th>宛先</Th>
            <Th>件名</Th>
            <Th>バウンス理由</Th>
            <Th width="w-40">送信者</Th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            // Links back into that recipient's own campaign, grouped the
            // same way the summary list groups it (JST calendar day of
            // createdAt) — see utcToJstDateInputValue's doc comment.
            const dateParam = utcToJstDateInputValue(log.createdAt);
            const detailHref = `/email-logs?subject=${encodeURIComponent(log.subject)}&sentBy=${encodeURIComponent(log.sentBy)}&date=${dateParam}`;
            return (
              <Tr key={log.id} tone="danger">
                <Td subtle nowrap>
                  {formatJstDateTime(new Date(log.createdAt))}
                </Td>
                <Td truncate={log.toEmail}>{log.toEmail}</Td>
                <Td truncate={log.subject}>
                  <Link href={detailHref} className={SUBJECT_LINK_CLASS} title={log.subject}>
                    {log.subject}
                  </Link>
                </Td>
                <Td truncate={log.bounceReason}>{log.bounceReason || "—"}</Td>
                <Td>{log.sentBy || "—"}</Td>
              </Tr>
            );
          })}
          {logs.length === 0 && (
            <EmptyState
              icon={MailCheck}
              title="バウンスした宛先はありません"
              description="宛先不明で届かなかったメールが、配信をまたいでここに集まります"
              colSpan={5}
            />
          )}
        </tbody>
      </Table>

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(n) => `/email-logs?view=bounced&page=${n}`}
        total={total}
        pageSize={BOUNCE_PAGE_SIZE}
      />
    </PageContainer>
  );
}
