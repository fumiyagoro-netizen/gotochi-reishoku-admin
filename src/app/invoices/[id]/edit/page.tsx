"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { InvoiceForm, type InvoiceData } from "@/components/invoice-form";
import { useRole } from "@/lib/role-context";
import { utcToJstDateInputValue } from "@/lib/award-dates";

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
      <h2 className="text-2xl font-bold text-gray-900 mb-6">請求書編集</h2>

      {loading ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
      ) : invoice ? (
        <InvoiceForm initial={invoice} />
      ) : null}
    </div>
  );
}
