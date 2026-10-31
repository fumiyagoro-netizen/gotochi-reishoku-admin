import { prisma } from "@/lib/prisma";
import { resolveAwardId, resolveAwardYear } from "@/lib/award";
import { getCurrentRole, getPermissions } from "@/lib/role";
import { stripEntryPrivateFields } from "@/lib/entry-privacy";
import {
  INVOICE_STATUSES,
  invoiceStatusOf,
  invoiceStatusWhere,
  isInvoiceStatus,
} from "@/lib/invoice-status-shared";
import { EntryTable } from "@/components/entry-table";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Button, ButtonLink } from "@/components/ui/button";
import { Toolbar, SearchInput } from "@/components/ui/toolbar";
import { Select } from "@/components/ui/field-controls";
import { Pagination } from "@/components/ui/pagination";
import { Download, Mail, Search, Upload, X } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export const metadata = { title: "エントリー一覧" };

interface Props {
  searchParams: Promise<{
    q?: string;
    category?: string;
    invoice?: string;
    page?: string;
    year?: string;
  }>;
}

const PAGE_SIZE = 20;

export default async function EntriesPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = params.q || "";
  const category = params.category || "";
  const page = Math.max(1, parseInt(params.page || "1"));
  const awardId = await resolveAwardId(params.year);
  const year = await resolveAwardYear(params.year);
  const yearParam = year ? `&year=${year}` : "";
  const role = await getCurrentRole();
  const perms = getPermissions(role);
  // 請求状況の絞り込みは見える人（管理者）だけ。他の役割では URL に付いていても無視する
  const invoice =
    perms.canSeeInvoiceStatus && params.invoice && isInvoiceStatus(params.invoice) ? params.invoice : "";

  const where = {
    AND: [
      awardId ? { awardId } : {},
      q
        ? {
            OR: [
              { companyName: { contains: q } },
              { productName: { contains: q } },
              { contactLastName: { contains: q } },
              { contactFirstName: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {},
      category ? { productCategory: category } : {},
      invoice ? invoiceStatusWhere(invoice) : {},
    ],
  };

  const [entries, total, categories] = await Promise.all([
    prisma.entry.findMany({
      where,
      orderBy: { answeredAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        images: {
          where: { imageType: "main" },
          take: 1,
        },
        // 請求状況は見える人の分だけ読む（他の役割には送信日時すらブラウザへ渡さない）
        invoices: perms.canSeeInvoiceStatus ? { select: { sentAt: true } } : false,
      },
      // 手動の請求済みの印も同じ（既定では読まない — src/lib/prisma.ts）
      omit: { invoiceMarkedAt: !perms.canSeeInvoiceStatus },
    }),
    prisma.entry.count({ where }),
    prisma.entry.groupBy({
      by: ["productCategory"],
      where: awardId ? { awardId } : {},
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // viewer has canSeePrivateInfo=false and the table hides the "担当者"
  // column entirely for them, but Server Component props are shipped to the
  // browser verbatim regardless of what the UI renders — so the applicant's
  // contact name / email / phone / submitter IP must be stripped here,
  // before the data is handed to the "use client" EntryTable, not just
  // hidden in JSX. See src/lib/entry-privacy.ts.
  const visibleEntries = (perms.canSeePrivateInfo ? entries : entries.map(stripEntryPrivateFields)).map(
    ({ invoices, invoiceMarkedAt, ...entry }) =>
      perms.canSeeInvoiceStatus
        ? { ...entry, invoiceStatus: invoiceStatusOf(entry.reviewStatus, invoices ?? [], invoiceMarkedAt ?? null) }
        : entry,
  );

  const filtered = Boolean(q || category || invoice);

  return (
    <PageContainer>
      <PageHeader
        title="エントリー一覧"
        count={total}
        actions={
          <>
            {perms.canSendEmail && (
              <ButtonLink href="/entries/email" icon={<Mail />}>
                応募者へメール配信
              </ButtonLink>
            )}
            {total > 0 && perms.canDownload && (
              <ButtonLink
                href={`/api/entries/export${year ? `?year=${year}` : ""}`}
                external
                icon={<Download />}
              >
                Excelダウンロード
              </ButtonLink>
            )}
            {/* Sits next to the download it pairs with: /upload only ever imports
                entries, and its own bulk-update instructions start with
                "エントリー一覧からExcelをダウンロード". Mirrors how the contacts
                CSV import lives under the contacts screen rather than in the nav. */}
            {perms.canUploadEntryCsv && (
              <ButtonLink href="/upload" variant="primary" icon={<Upload />}>
                CSVアップロード
              </ButtonLink>
            )}
          </>
        }
      >
        {/* Search & Filter */}
        <Toolbar
          applied={filtered}
          clear={
            <ButtonLink
              href={`/entries${year ? `?year=${year}` : ""}`}
              variant="ghost"
              icon={<X />}
            >
              クリア
            </ButtonLink>
          }
        >
          <form className="flex flex-wrap items-center gap-2">
            {year && <input type="hidden" name="year" value={year} />}
            <SearchInput
              type="text"
              name="q"
              defaultValue={q}
              placeholder="企業名・商品名・担当者名で検索..."
              active={Boolean(q)}
            />
            <div className="w-44">
              <Select
                name="category"
                defaultValue={category}
                data-active={category ? "true" : undefined}
              >
                <option value="">全カテゴリ</option>
                {categories.map((cat) => (
                  <option key={cat.productCategory} value={cat.productCategory}>
                    {cat.productCategory || "未分類"} ({cat._count.id})
                  </option>
                ))}
              </Select>
            </div>
            {perms.canSeeInvoiceStatus && (
              <div className="w-40">
                <Select
                  name="invoice"
                  defaultValue={invoice}
                  aria-label="請求状況"
                  data-active={invoice ? "true" : undefined}
                >
                  <option value="">請求状況：すべて</option>
                  {INVOICE_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <Button type="submit" icon={<Search />}>
              検索
            </Button>
          </form>
        </Toolbar>
      </PageHeader>

      {/* Entry Table with checkboxes */}
      <EntryTable entries={visibleEntries} year={year} filtered={filtered} />

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        hrefFor={(n) => `/entries?q=${q}&category=${category}${invoice ? `&invoice=${invoice}` : ""}&page=${n}${yearParam}`}
      />
    </PageContainer>
  );
}
