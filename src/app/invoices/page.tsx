"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRole } from "@/lib/role-context";
import { formatYen } from "@/lib/invoice-shared";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { NoPermission } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Toolbar, SearchInput } from "@/components/ui/toolbar";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Plus, Search, X, Receipt } from "@/components/ui/icons";

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

// GET /api/invoices の PAGE_SIZE と同じ値。ページ送りの「1–20 / 57件」表示にだけ使う
const PAGE_SIZE = 20;

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
      <PageContainer>
        <NoPermission message="閲覧権限がありません" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="請求書"
        meta={year && <Badge tone="neutral">{year}年度</Badge>}
        count={total}
        actions={
          <>
            <ButtonLink href="/invoices/items" variant="secondary">
              請求項目マスタ
            </ButtonLink>
            <ButtonLink href="/invoices/new" variant="primary" icon={<Plus />}>
              新規作成
            </ButtonLink>
          </>
        }
      />

      {errorMsg && (
        <div className="mb-4">
          <Alert tone="danger">{errorMsg}</Alert>
        </div>
      )}

      <Toolbar
        applied={!!q}
        clear={
          <Button variant="ghost" icon={<X />} onClick={handleClear}>
            クリア
          </Button>
        }
      >
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
          <SearchInput
            type="text"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="書類番号・宛先名で検索..."
            active={!!q}
          />
          <Button type="submit" variant="secondary" icon={<Search />}>
            検索
          </Button>
        </form>
      </Toolbar>

      {loading ? (
        <TableSkeleton cols={6} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>書類番号</Th>
              <Th>宛先</Th>
              <Th align="right">金額（税込）</Th>
              <Th>発行日</Th>
              <Th>支払期限</Th>
              <Th>送信状況</Th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              // 行自体にクリック先は無いので cursor-pointer は付けない（書類番号と送信状況のリンクから編集へ）
              <Tr key={inv.id}>
                <Td nowrap>
                  <Link
                    href={`/invoices/${inv.id}/edit`}
                    className="rounded-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    {inv.invoiceNo}
                  </Link>
                </Td>
                <Td primary>{inv.recipientName} 様</Td>
                {/* 金額は主要な数値なので補助色ではなく本文色（太字にはしない） */}
                <Td numeric tone="ink">{formatYen(inv.totalAmount)}</Td>
                <Td subtle nowrap>{formatJstDate(inv.issueDate)}</Td>
                <Td subtle nowrap>{formatJstDate(inv.dueDate)}</Td>
                <Td nowrap>
                  <Link
                    href={`/invoices/${inv.id}/edit`}
                    className="inline-flex items-center gap-1.5 rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    {inv.sentAt ? (
                      <>
                        <Badge tone="success">送信済み</Badge>
                        <span className="text-caption text-ink-subtle">{formatJstDateTime(inv.sentAt)}</span>
                      </>
                    ) : (
                      <Badge tone="outline">未送信</Badge>
                    )}
                  </Link>
                </Td>
              </Tr>
            ))}
            {invoices.length === 0 && (
              <EmptyState
                icon={Receipt}
                title="請求書がありません"
                description={
                  q
                    ? "検索条件に一致する請求書がありません。条件を変えるかクリアしてください"
                    : "「新規作成」から作成すると、ここに表示されます"
                }
                colSpan={6}
              />
            )}
          </tbody>
        </Table>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        onChange={setPage}
        total={total}
        pageSize={PAGE_SIZE}
      />
    </PageContainer>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense>
      <InvoicesPageInner />
    </Suspense>
  );
}
