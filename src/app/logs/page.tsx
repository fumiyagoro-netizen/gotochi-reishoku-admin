import { prisma } from "@/lib/prisma";
import { getCurrentRole } from "@/lib/role";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login: { label: "ログイン", color: "bg-green-100 text-green-700" },
  create: { label: "作成", color: "bg-blue-100 text-blue-700" },
  update: { label: "編集", color: "bg-yellow-100 text-yellow-800" },
  delete: { label: "削除", color: "bg-red-100 text-red-700" },
  prize: { label: "受賞設定", color: "bg-amber-100 text-amber-800" },
  bulk_prize: { label: "一括受賞", color: "bg-amber-100 text-amber-800" },
  upload: { label: "アップロード", color: "bg-purple-100 text-purple-700" },
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
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        操作ログ
        <span className="text-base font-normal text-gray-500 ml-3">
          {total}件
        </span>
      </h2>

      {/* Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Link
          href="/logs"
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            !actionFilter ? "bg-blue-50 border-blue-300 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          すべて
        </Link>
        {Object.entries(ACTION_LABELS).map(([key, { label, color }]) => (
          <Link
            key={key}
            href={`/logs?action=${key}`}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              actionFilter === key ? `${color} border-current` : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Log Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-40">日時</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-28">操作</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-40">ユーザー</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">詳細</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log) => {
              const actionInfo = ACTION_LABELS[log.action] || {
                label: log.action,
                color: "bg-gray-100 text-gray-600",
              };
              return (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("ja-JP", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${actionInfo.color}`}>
                      {actionInfo.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {log.userEmail || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-lg truncate">
                    {log.detail}
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                  ログがありません
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
              href={`/logs?action=${actionFilter}&page=${page - 1}`}
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
              href={`/logs?action=${actionFilter}&page=${page + 1}`}
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
