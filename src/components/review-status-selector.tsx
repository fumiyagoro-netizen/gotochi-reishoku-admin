"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  REVIEW_STATUSES,
  REVIEW_PILL_CLASS,
  parseReviewStatuses,
} from "@/lib/review-status-shared";
import { TogglePill } from "@/components/ui/toggle-pill";

export function ReviewStatusSelector({
  entryId,
  currentStatus,
}: {
  entryId: number;
  currentStatus: string;
}) {
  const [statuses, setStatuses] = useState<string[]>(parseReviewStatuses(currentStatus));
  const [saving, setSaving] = useState(false);
  // 押した1つだけスピナーを出すために覚えておく（送信ロジックには関与しない）
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const router = useRouter();

  async function toggleStatus(value: string) {
    const current = new Set(statuses);
    if (current.has(value)) {
      current.delete(value);
    } else {
      current.add(value);
    }
    const newStatus = Array.from(current).join(",");
    setPendingValue(value);
    setSaving(true);
    try {
      const res = await fetch(`/api/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setStatuses(Array.from(current));
        router.refresh();
      }
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {REVIEW_STATUSES.map((rs) => {
        const isActive = statuses.includes(rs.value);
        return (
          <TogglePill
            key={rs.value}
            pressed={isActive}
            pending={saving && pendingValue === rs.value}
            disabled={saving}
            toneClassName={REVIEW_PILL_CLASS[rs.value]}
            onClick={() => toggleStatus(rs.value)}
          >
            {rs.label}
          </TogglePill>
        );
      })}
    </div>
  );
}

// 本体は ui/badge.tsx に移った。import 先（entry-table / entry-detail）を変えずに済むよう再 export する
export { ReviewBadge } from "@/components/ui/badge";
