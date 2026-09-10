"use client";

import { Suspense } from "react";
import { InvoiceForm } from "@/components/invoice-form";
import { useRole } from "@/lib/role-context";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { NoPermission } from "@/components/ui/card";

export default function NewInvoicePage() {
  const { permissions } = useRole();

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
      <PageHeader title="請求書作成" backHref="/invoices" backLabel="請求書一覧" />
      {/* InvoiceForm reads ?year= via useSearchParams, which Next.js
          requires a Suspense boundary for. */}
      <Suspense>
        <InvoiceForm />
      </Suspense>
    </PageContainer>
  );
}
