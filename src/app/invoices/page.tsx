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
import { StatCard } from "@/components/ui/stat-card";
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

// GET /api/invoices/summary の戻り。年度は紐づくエントリーの年度で数える
// （発行日の暦年ではない — 一覧の年度絞り込みと同じ定義にするため）
interface YearSummary {
  year: number;
  count: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  unsentCount: number;
}

// 全年度を足した行。年度の区別が無いだけで項目は同じ
type AllYearsTotal = Omit<YearSummary, "year">;

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

  // 年度ごとの売上。検索語やページ送りでは変わらない数字なので、一覧とは
  // 別の useEffect で一度だけ取る（年度を切り替えても中身は同じ）。
  const [summary, setSummary] = useState<{ years: YearSummary[]; total: AllYearsTotal } | null>(null);
  const [summaryError, setSummaryError] = useState("");

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

  useEffect(() => {
    let cancelled = false;
    fetch("/api/invoices/summary")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) setSummary({ years: data.years, total: data.total });
        else setSummaryError(data.message || "集計の取得に失敗しました");
      })
      .catch(() => {
        if (!cancelled) setSummaryError("集計の取得に失敗しました");
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  // いま一覧に出ている年度。?year= が無いときサーバー側（resolveAwardId）は最新年度に
  // 落とすので、サマリー側も同じく先頭（years は年度の降順）を選択中として扱う。
  const selectedYear = year ? Number(year) : summary?.years[0]?.year;

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

      {summaryError && (
        <div className="mb-4">
          <Alert tone="warning">{summaryError}</Alert>
        </div>
      )}

      {/* 年度ごとの売上。下の一覧と違い検索語では絞られない（年度どうしを見比べるための数字なので）。
          カードを押すとその年度の一覧に切り替わる — サイドバーの年度セレクタは ?year= を読むので
          ここから遷移しても選択状態がずれない。 */}
      {summary && (
        <div className="mb-6">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="text-sm font-medium text-ink">年度ごとの売上（税込）</h2>
            <p className="text-caption text-ink-subtle">請求書の発行額の合計です（入金状況は含みません）</p>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {summary.years.map((y) => (
              <StatCard
                key={y.year}
                label={`${y.year}年度`}
                value={formatYen(y.totalAmount)}
                hint={
                  y.count === 0
                    ? "請求書なし"
                    : `${y.count}件 ・ 税抜 ${formatYen(y.subtotal)}${
                        y.unsentCount > 0 ? ` ・ 未送信 ${y.unsentCount}件` : ""
                      }`
                }
                href={`/invoices?year=${y.year}`}
                selected={y.year === selectedYear}
              />
            ))}
            {summary.years.length > 1 && (
              <StatCard
                label="全年度合計"
                value={formatYen(summary.total.totalAmount)}
                hint={`${summary.total.count}件 ・ 税抜 ${formatYen(summary.total.subtotal)}`}
              />
            )}
          </div>
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
