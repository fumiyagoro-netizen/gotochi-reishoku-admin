"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * 詳細画面の「請求済みにする」「取り消す」（手動の請求済み — src/lib/invoice-status-shared.ts）。
 * 出すかどうかは呼ぶ側が canSeeInvoiceStatus で決める
 */
export function InvoiceMarkButton({ entryId, marked }: { entryId: number; marked: boolean }) {
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/entries/invoice-mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryIds: [entryId], marked: !marked }),
      });
      const data = await res.json();
      if (data.success) router.refresh();
      else alert(data.message);
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button size="sm" variant="link" onClick={submit} disabled={saving}>
      {marked ? "手動の請求済みを取り消す" : "請求済みにする"}
    </Button>
  );
}
