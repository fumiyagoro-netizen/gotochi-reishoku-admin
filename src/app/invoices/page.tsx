"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRole } from "@/lib/role-context";
import { formatYen } from "@/lib/invoice-shared";

interface InvoiceRow {
  id: number;
  invoiceNo: string;
  recipientName: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  entry: { companyName: string; award: { year: number } };
  // GET /api/invoices doesn't select individual Invoice columns (see that
  // route), so these come through automatically once added to the schema —
  // no server-side change was needed to expose them here.
  sentAt: string | null;
  sentTo: string;
}

function formatJstDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function formatJstDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Reads ?year= from the URL — sidebar always appends it once at least one
// Award exists (src/components/sidebar.tsx hrefWithYear) — so this stays
// wrapped in Suspense per Next.js's useSearchParams requirement, same as
// src/app/prospects/page.tsx.
function InvoicesPageInner() {
  const { permissions } = useRole();
  const searchParams = useSearchParams();
  const year = searchParams.get("year");
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const params = new URLSearchParams();
      if (year) params.set("year", year);
      if (q) params.set("q", q);
      params.set("page", String(page));
      const res = await fetch(`/api/invoices?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setInvoices(data.invoices);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } else {
        setErrorMsg(data.message || "取得に失敗しました");
      }
    } catch (e) {
      setErrorMsg("通信エラー: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, [year, q, page]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // 年度を切り替えたら1ページ目に戻す（src/app/prospects/page.tsx と同じ扱い）。
  useEffect(() => {
    setPage(1);
  }, [year]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQ(qInput);
    setPage(1);
  }

  function handleClear() {
    setQInput("");
    setQ("");
    setPage(1);
  }

  if (!permissions.canManageInvoices) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">閲覧権限がありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          請求書
          {year && <span className="text-base font-normal text-gray-500 ml-3">{year}年度</span>}
          <span className="text-base font-normal text-gray-500 ml-3">{total}件</span>
        </h2>
        <div className="flex items-center gap-2">
          <Link
            href="/invoices/items"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700
              hover:bg-gray-50 transition-colors"
          >
            請求項目マスタ
          </Link>
          <Link
            href="/invoices/new"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium
              hover:bg-blue-700 transition-colors"
          >
            + 新規作成
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg break-words">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="書類番号・宛先名で検索..."
          className="flex-1 min-w-[220px] max-w-md px-4 py-2.5 border border-gray-300 rounded-lg text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="submit"
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium
            hover:bg-blue-700 transition-colors"
        >
          検索
        </button>
        {q && (
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2.5 text-gray-600 border border-gray-300 rounded-lg text-sm
              hover:bg-gray-50 transition-colors"
          >
            クリア
          </button>
        )}
      </form>

      {loading ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">書類番号</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">宛先</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">金額（税込）</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">発行日</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">支払期限</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">送信状況</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <Link href={`/invoices/${inv.id}/edit`} className="text-blue-600 hover:underline">
                      {inv.invoiceNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{inv.recipientName} 様</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">
                    {formatYen(inv.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{formatJstDate(inv.issueDate)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{formatJstDate(inv.dueDate)}</td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    <Link href={`/invoices/${inv.id}/edit`} className="hover:underline">
                      {inv.sentAt ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            送信済み
                          </span>
                          <span className="text-xs text-gray-400">{formatJstDateTime(inv.sentAt)}</span>
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                          未送信
                        </span>
                      )}
                    </Link>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    請求書がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {page > 1 && (
            <button
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              前へ
            </button>
          )}
          <span className="px-3 py-2 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <button
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              次へ
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense>
      <InvoicesPageInner />
    </Suspense>
  );
}
