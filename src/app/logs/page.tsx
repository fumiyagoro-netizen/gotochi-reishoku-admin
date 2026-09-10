import { prisma } from "@/lib/prisma";
import { getCurrentRole } from "@/lib/role";
import { redirect } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { FilterChip, FilterChipGroup } from "@/components/ui/filter-chip";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { History } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export const metadata = { title: "操作ログ" };

// tone は Badge の意味色。Badge に無い色（受賞の琥珀・アップロードの紫・再開の翠）だけ
// tone="custom" ＋ 完全クラス文字列。dot はフィルタチップの先頭の点。
const ACTION_LABELS: Record<
  string,
  { label: string; tone: BadgeTone; className?: string; dot: string }
> = {
  login: { label: "ログイン", tone: "success", dot: "bg-emerald-500" },
  create: { label: "作成", tone: "info", dot: "bg-blue-500" },
  update: { label: "編集", tone: "warning", dot: "bg-yellow-400" },
  delete: { label: "削除", tone: "danger", dot: "bg-red-500" },
  prize: {
    label: "受賞設定",
    tone: "custom",
    className: "bg-amber-50 text-amber-800 ring-amber-600/25",
    dot: "bg-amber-500",
  },
  bulk_prize: {
    label: "一括受賞",
    tone: "custom",
    className: "bg-amber-50 text-amber-800 ring-amber-600/25",
    dot: "bg-amber-500",
  },
  upload: {
    label: "アップロード",
    tone: "custom",
    className: "bg-purple-50 text-purple-700 ring-purple-600/20",
    dot: "bg-purple-500",
  },
  unsubscribe: { label: "配信停止", tone: "outline", dot: "bg-zinc-400" },
  resubscribe: {
    label: "配信再開",
    tone: "custom",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    dot: "bg-emerald-500",
  },
};

interface Props {
  searchParams: Promise<{ page?: string; action?: string }>;
}

const PAGE_SIZE = 50;

export default async function LogsPage({ searchParams }: Props) {
  const role = await getCurrentRole();
  if (role !== "admin") redirect("/");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const actionFilter = params.action || "";

  const where = actionFilter ? { action: actionFilter } : {};

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <PageContainer>
      <PageHeader title="操作ログ" count={total} />

      {/* Filter */}
      <FilterChipGroup>
        <FilterChip href="/logs" active={!actionFilter}>
          すべて
        </FilterChip>
        {Object.entries(ACTION_LABELS).map(([key, { label, dot }]) => (
          <FilterChip
            key={key}
            href={`/logs?action=${key}`}
            active={actionFilter === key}
            dotClassName={dot}
          >
            {label}
          </FilterChip>
        ))}
      </FilterChipGroup>

      {/* Log Table */}
      <Table density="compact">
        <thead>
          <tr>
            <Th width="w-40">日時</Th>
            <Th width="w-28">操作</Th>
            <Th width="w-40">ユーザー</Th>
            <Th>詳細</Th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            // 未知の action は neutral ＋ 生文字列で落とさない
            const actionInfo = ACTION_LABELS[log.action] || {
              label: log.action,
              tone: "neutral" as const,
              className: undefined,
              dot: "",
            };
            return (
              <Tr key={log.id}>
                <Td subtle nowrap>
                  {/* Rendered on the server, which runs in UTC — without an
                      explicit timeZone this shows every log 9 hours behind
                      the Japan time the operator actually acted at. */}
                  {new Date(log.createdAt).toLocaleString("ja-JP", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Tokyo",
                  })}
                </Td>
                <Td>
                  <Badge tone={actionInfo.tone} className={actionInfo.className}>
                    {actionInfo.label}
                  </Badge>
                </Td>
                <Td>{log.userEmail || "—"}</Td>
                {/* 切れた全文は title で読める */}
                <Td truncate={log.detail}>{log.detail}</Td>
              </Tr>
            );
          })}
          {logs.length === 0 && (
            <EmptyState
              icon={History}
              title="ログがありません"
              description={
                actionFilter
                  ? "この操作のログはまだありません。「すべて」で他の操作も確認できます"
                  : "ログイン・作成・編集などの操作が記録されると、ここに表示されます"
              }
              colSpan={4}
            />
          )}
        </tbody>
      </Table>

      {/* Pagination — ?action= は空でも付ける（既存の href をそのまま関数化） */}
      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(n) => `/logs?action=${actionFilter}&page=${n}`}
        total={total}
        pageSize={PAGE_SIZE}
      />
    </PageContainer>
  );
}
