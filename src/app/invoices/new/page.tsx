"use client";

import { Suspense } from "react";
import Link from "next/link";
import { InvoiceForm } from "@/components/invoice-form";
import { useRole } from "@/lib/role-context";

export default function NewInvoicePage() {
  const { permissions } = useRole();

  // Part of the invoices feature — gated the same way as /invoices. The API
  // enforces this too; this only keeps the page from rendering the form for
  // roles that must not reach it.
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
      <div className="mb-6">
        <Link href="/invoices" className="text-sm text-gray-500 hover:text-gray-700">
          ← 請求書一覧
        </Link>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">請求書作成</h2>
      {/* InvoiceForm reads ?year= via useSearchParams, which Next.js
          requires a Suspense boundary for. */}
      <Suspense>
        <InvoiceForm />
      </Suspense>
    </div>
  );
}
