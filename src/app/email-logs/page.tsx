import { prisma } from "@/lib/prisma";
import { getCurrentRole } from "@/lib/role";
import { getPermissions } from "@/lib/role-shared";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Prisma, EmailLog } from "@prisma/client";

export const dynamic = "force-dynamic";

// Open-tracking (email.opened / email.clicked) is deliberately out of scope
// for this screen — see src/app/api/webhooks/resend/route.ts, which accepts
// those events but ignores them. Only delivered / bounced / complained are
// tracked, since open/click rates are unreliable signals (image blocking,
// link scanners, etc.) while delivery failure is a hard fact worth acting on.
type DisplayStatus = "bounced" | "complained" | "delivered" | "pending" | "skipped" | "failed" | "test";

const STATUS_META: Record<DisplayStatus, { label: string; color: string }> = {
  bounced: { label: "バウンス（宛先不明）", color: "bg-red-100 text-red-700" },
  complained: { label: "迷惑メール報告", color: "bg-purple-100 text-purple-700" },
  delivered: { label: "配信済み", color: "bg-green-100 text-green-700" },
  pending: { label: "送信済み(結果待ち)", color: "bg-blue-100 text-blue-700" },
  skipped: { label: "スキップ(配信停止)", color: "bg-gray-100 text-gray-600" },
  failed: { label: "失敗", color: "bg-orange-100 text-orange-700" },
  test: { label: "テスト送信", color: "bg-indigo-100 text-indigo-700" },
};

// Bounce/complaint checked first even for filter chips: an event Resend
// reported after the fact always wins over the "sent" status recorded at
// send time, since it reflects what actually happened to the message.
const STATUS_FILTER_ORDER: DisplayStatus[] = [
  "bounced",
  "complained",
  "delivered",
  "pending",
  "skipped",
  "failed",
  "test",
];

const STATUS_FILTER_WHERE: Record<DisplayStatus, Prisma.EmailLogWhereInput> = {
  bounced: { bouncedAt: { not: null } },
  complained: { complainedAt: { not: null } },
  delivered: { deliveredAt: { not: null } },
  // "sent" but no webhook has updated it yet (also covers legacy rows from
  // before messageId existed, which can never be matched by a webhook).
  pending: { status: "sent", deliveredAt: null, bouncedAt: null, complainedAt: null },
  skipped: { status: "skipped" },
  failed: { status: "failed" },
  test: { status: "test" },
};

// Same precedence as STATUS_FILTER_WHERE above, applied to a single row: a
// bounce/complaint/delivery event always overrides the original send-time
// status, since it reflects what actually happened after sending.
function deriveStatus(
  log: Pick<EmailLog, "status" | "deliveredAt" | "bouncedAt" | "complainedAt">
): DisplayStatus {
  if (log.bouncedAt) return "bounced";
  if (log.complainedAt) return "complained";
  if (log.deliveredAt) return "delivered";
  if (log.status === "skipped") return "skipped";
  if (log.status === "failed") return "failed";
  if (log.status === "test") return "test";
  return "pending";
}

interface Props {
  searchParams: Promise<{ page?: string; status?: string }>;
}

const PAGE_SIZE = 50;

export default async function EmailLogsPage({ searchParams }: Props) {
  const role = await getCurrentRole();
  const perms = getPermissions(role);
  if (!perms.canSendEmail) redirect("/");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const statusFilter: DisplayStatus | "" =
    params.status && (STATUS_FILTER_ORDER as string[]).includes(params.status)
      ? (params.status as DisplayStatus)
      : "";

  const where = statusFilter ? STATUS_FILTER_WHERE[statusFilter] : {};

  const [logs, total] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.emailLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        配信履歴
        <span className="text-base font-normal text-gray-500 ml-3">
          {total}件
        </span>
      </h2>

      {/* Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Link
          href="/email-logs"
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            !statusFilter ? "bg-blue-50 border-blue-300 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          すべて
        </Link>
        {STATUS_FILTER_ORDER.map((key) => {
          const meta = STATUS_META[key];
          return (
            <Link
              key={key}
              href={`/email-logs?status=${key}`}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                statusFilter === key ? `${meta.color} border-current` : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {meta.label}
            </Link>
          );
        })}
      </div>

      {/* Log Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-40">送信日時</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">宛先</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">件名</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-48">状態</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-40">送信者</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log) => {
              const derived = deriveStatus(log);
              const meta = STATUS_META[derived];
              return (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {/* Rendered on the server, which runs in UTC — without an
                        explicit timeZone this shows every send 9 hours behind
                        the Japan time it actually happened at. */}
                    {new Date(log.createdAt).toLocaleString("ja-JP", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Asia/Tokyo",
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate" title={log.toEmail}>
                    {log.toEmail}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-sm truncate" title={log.subject}>
                    {log.subject}
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
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {log.sentBy || "—"}
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  配信履歴がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {page > 1 && (
            <Link
              href={`/email-logs?status=${statusFilter}&page=${page - 1}`}
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
              href={`/email-logs?status=${statusFilter}&page=${page + 1}`}
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
