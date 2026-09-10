"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "@/components/ui/icons";

interface Props {
  statusFilter: string;
  statusLabel: string;
  entryIds: number[];
}

export function ReviewNotifyButton({ statusFilter, statusLabel, entryIds }: Props) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  if (!statusFilter || entryIds.length === 0) return null;

  const reviewStage = statusFilter === "first_passed" ? "1次審査" : "2次審査";

  async function handleSend() {
    if (!confirm(`${statusLabel}の${entryIds.length}件に通過通知メールを送信しますか？`)) return;

    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/entries/bulk-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryIds, reviewStage }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ sent: data.sent, failed: data.failed });
      } else {
        alert(data.message || "送信に失敗しました");
      }
    } catch {
      alert("送信に失敗しました");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="primary"
        icon={<Send />}
        loading={sending}
        disabled={sending}
        onClick={handleSend}
      >
        {sending ? "送信中..." : `${statusLabel}通過通知を送信`}
      </Button>
      {result && (
        <span className="text-sm text-success-ink">
          {result.sent}件送信完了{result.failed > 0 ? ` (${result.failed}件失敗)` : ""}
        </span>
      )}
    </div>
  );
}
