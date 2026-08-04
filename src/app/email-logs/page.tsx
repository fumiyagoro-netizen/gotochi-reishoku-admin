import { prisma } from "@/lib/prisma";
import { getCurrentRole } from "@/lib/role";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Prisma, EmailLog } from "@prisma/client";
import { jstDateStringToStartOfDayUtc, utcToJstDateInputValue } from "@/lib/award-dates";

export const dynamic = "force-dynamic";

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

const STATUS_META: Record<DisplayStatus, { label: string; color: string }> = {
  bounced: { label: "バウンス（宛先不明）", color: "bg-red-100 text-red-700" },
  complained: { label: "迷惑メール報告", color: "bg-purple-100 text-purple-700" },
  delivered: { label: "配信済み", color: "bg-green-100 text-green-700" },
  pending: { label: "結果待ち", color: "bg-blue-100 text-blue-700" },
  // Webhook (RESEND_WEBHOOK_SECRET / src/app/api/webhooks/resend) was set up
  // after these rows were sent, so messageId is "" and no delivery event
  // will ever arrive for them. Showing these as "結果待ち" would make them
  // look like they're stuck waiting forever, and counting them in the
  // reachability denominator would understate the real delivery rate — so
  // they get their own label and are excluded from that calculation
  // (see measured/measuredDelivered below).
  untracked: { label: "計測対象外", color: "bg-slate-100 text-slate-500" },
  skipped: { label: "スキップ(配信停止)", color: "bg-gray-100 text-gray-600" },
  failed: { label: "失敗", color: "bg-orange-100 text-orange-700" },
  test: { label: "テスト送信", color: "bg-indigo-100 text-indigo-700" },
};

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
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        配信履歴
        <span className="text-base font-normal text-gray-500 ml-3">{totalGroups}件の配信</span>
      </h2>

      {/* Top summary — what the user needs to know first is "did anything fail to arrive". */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">総配信数</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{totalAll}</p>
          <p className="text-xs text-gray-400 mt-1">宛先単位の送信件数</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">配信済み</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{deliveredAll}</p>
        </div>
        <Link
          href="/email-logs?view=bounced"
          className="bg-white rounded-xl border border-gray-200 p-6 hover:bg-gray-50 transition-colors"
        >
          <p className="text-sm text-gray-500">バウンス（要対応）</p>
          <p className={`text-3xl font-bold mt-2 ${bouncedAll > 0 ? "text-red-600" : "text-gray-900"}`}>
            {bouncedAll}
          </p>
        </Link>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">迷惑メール報告</p>
          <p className={`text-3xl font-bold mt-2 ${complainedAll > 0 ? "text-purple-600" : "text-gray-900"}`}>
            {complainedAll}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">到達率</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{reachRateAll}</p>
          {measuredAll === 0 && (
            <p className="text-xs text-gray-400 mt-1">計測対象なし（Webhook設定前の送信のみ）</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-40">送信日時</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">件名</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase w-20">宛先数</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-24">到達率</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">内訳</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-40">送信者</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {groups.map((g) => {
              // Bounces/complaints are the whole point of this screen — a
              // tinted row background makes a bad campaign visible without
              // reading every badge.
              const rowTint =
                g.bounced > 0 ? "bg-red-50 hover:bg-red-100" : g.complained > 0 ? "bg-purple-50 hover:bg-purple-100" : "hover:bg-gray-50";
              const dateParam = utcToJstDateInputValue(g.sendDate);
              const detailHref = `/email-logs?subject=${encodeURIComponent(g.subject)}&sentBy=${encodeURIComponent(g.sentBy)}&date=${dateParam}`;
              return (
                <tr key={`${g.subject}__${g.sentBy}__${dateParam}`} className={`transition-colors ${rowTint}`}>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap align-top">
                    {formatJstDateTime(new Date(g.firstSentAt))}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Link
                      href={detailHref}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      title={g.subject}
                    >
                      {g.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right align-top">{g.total}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 align-top">
                    {formatReachRate(g.measured, g.measuredDelivered)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex gap-1 flex-wrap">
                      {STATUS_ORDER.filter((key) => g[key] > 0).map((key) => (
                        <span
                          key={key}
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_META[key].color}`}
                        >
                          {STATUS_META[key].label} {g[key]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 align-top">{g.sentBy || "—"}</td>
                </tr>
              );
            })}
            {groups.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  配信履歴がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {page > 1 && (
            <Link
              href={`/email-logs?page=${page - 1}`}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              前へ
            </Link>
          )}
          <span className="px-3 py-2 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/email-logs?page=${page + 1}`}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              次へ
            </Link>
          )}
        </div>
      )}
    </div>
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
    <div className="p-8">
      <Link href="/email-logs" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
        ← 配信履歴に戻る
      </Link>
      <h2 className="text-2xl font-bold text-gray-900 mt-2 mb-1">{subject}</h2>
      <p className="text-sm text-gray-500 mb-6">
        配信日: {formatJstDate(dayStart)}（日本時間）　送信者: {sentBy || "—"}　宛先: {total}件
        {statusFilter ? "（絞り込み中）" : ""}
      </p>

      <div className="flex gap-2 mb-6 flex-wrap">
        <Link
          href={`/email-logs?${qs}`}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            !statusFilter ? "bg-blue-50 border-blue-300 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          すべて
        </Link>
        {STATUS_ORDER.map((key) => {
          const meta = STATUS_META[key];
          return (
            <Link
              key={key}
              href={`/email-logs?${qs}&status=${key}`}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                statusFilter === key ? `${meta.color} border-current` : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {meta.label}
            </Link>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-40">送信日時</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">宛先</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-48">状態</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log) => {
              const derived = deriveStatus(log);
              const meta = STATUS_META[derived];
              return (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {formatJstDateTime(new Date(log.createdAt))}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate" title={log.toEmail}>
                    {log.toEmail}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${meta.color}`}>
                      {meta.label}
                    </span>
                    {derived === "bounced" && log.bounceReason && (
                      <p className="text-xs text-gray-400 mt-1 max-w-xs truncate" title={log.bounceReason}>
                        {log.bounceReason}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center text-gray-400">
                  該当する宛先がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {page > 1 && (
            <Link
              href={`/email-logs?${qs}${statusFilter ? `&status=${statusFilter}` : ""}&page=${page - 1}`}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              前へ
            </Link>
          )}
          <span className="px-3 py-2 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/email-logs?${qs}${statusFilter ? `&status=${statusFilter}` : ""}&page=${page + 1}`}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              次へ
            </Link>
          )}
        </div>
      )}
    </div>
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
    <div className="p-8">
      <Link href="/email-logs" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
        ← 配信履歴に戻る
      </Link>
      <h2 className="text-2xl font-bold text-gray-900 mt-2 mb-6">
        バウンス一覧（全配信横断）
        <span className="text-base font-normal text-gray-500 ml-3">{total}件</span>
      </h2>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-40">送信日時</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">宛先</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">件名</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">バウンス理由</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-40">送信者</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log) => {
              // Links back into that recipient's own campaign, grouped the
              // same way the summary list groups it (JST calendar day of
              // createdAt) — see utcToJstDateInputValue's doc comment.
              const dateParam = utcToJstDateInputValue(log.createdAt);
              const detailHref = `/email-logs?subject=${encodeURIComponent(log.subject)}&sentBy=${encodeURIComponent(log.sentBy)}&date=${dateParam}`;
              return (
                <tr key={log.id} className="bg-red-50 hover:bg-red-100 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {formatJstDateTime(new Date(log.createdAt))}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate" title={log.toEmail}>
                    {log.toEmail}
                  </td>
                  <td className="px-4 py-3 max-w-sm truncate">
                    <Link
                      href={detailHref}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      title={log.subject}
                    >
                      {log.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-sm truncate" title={log.bounceReason}>
                    {log.bounceReason || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{log.sentBy || "—"}</td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  バウンスした宛先はありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {page > 1 && (
            <Link
              href={`/email-logs?view=bounced&page=${page - 1}`}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              前へ
            </Link>
          )}
          <span className="px-3 py-2 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/email-logs?view=bounced&page=${page + 1}`}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              次へ
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
