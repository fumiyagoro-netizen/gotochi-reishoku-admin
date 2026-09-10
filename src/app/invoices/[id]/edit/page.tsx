"use client";

import { useState, useEffect, use } from "react";
import { Suspense } from "react";
import { InvoiceForm, type InvoiceData } from "@/components/invoice-form";
import { useRole } from "@/lib/role-context";
import { utcToJstDateInputValue } from "@/lib/award-dates";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { NoPermission } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { CardSkeleton } from "@/components/ui/skeleton";

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { permissions } = useRole();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const inv = data.invoice;
          setInvoice({
            id: inv.id,
            invoiceNo: inv.invoiceNo,
            recipientName: inv.recipientName,
            issueDate: utcToJstDateInputValue(inv.issueDate),
            dueDate: utcToJstDateInputValue(inv.dueDate),
            notes: inv.notes,
            lines: inv.lines.map((l: { date: string; name: string; quantity: number; unit: string; unitPrice: number }) => ({
              date: utcToJstDateInputValue(l.date),
              name: l.name,
              quantity: l.quantity,
              unit: l.unit,
              unitPrice: l.unitPrice,
            })),
            entry: inv.entry,
            sentAt: inv.sentAt,
            sentTo: inv.sentTo,
            sentBy: inv.sentBy,
          });
        } else {
          setError(data.message);
        }
        setLoading(false);
      });
  }, [id]);

  // Part of the invoices feature — gated the same way as /invoices. The API
  // enforces this too; this only keeps the page from rendering the form for
  // roles that must not reach it.
  if (!permissions.canManageInvoices) {
    return (
      <PageContainer width="form">
        <NoPermission message="閲覧権限がありません" />
      </PageContainer>
    );
  }

  return (
    <PageContainer width="form">
      <PageHeader title="請求書編集" backHref="/invoices" backLabel="請求書一覧" />

      {loading ? (
        <CardSkeleton lines={5} />
      ) : error ? (
        <Alert tone="danger">{error}</Alert>
      ) : invoice ? (
        // InvoiceForm reads ?year= via useSearchParams, which Next.js requires
        // a Suspense boundary for.
        <Suspense>
          <InvoiceForm initial={invoice} />
        </Suspense>
      ) : null}
    </PageContainer>
  );
}
