"use client";

import { useState } from "react";

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
      <button
        onClick={handleSend}
        disabled={sending}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
      >
        {sending ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            送信中...
          </>
        ) : (
          <>✉️ {statusLabel}通過通知を送信</>
        )}
      </button>
      {result && (
        <span className="text-sm text-green-700">
          {result.sent}件送信完了{result.failed > 0 ? ` (${result.failed}件失敗)` : ""}
        </span>
      )}
    </div>
  );
}
