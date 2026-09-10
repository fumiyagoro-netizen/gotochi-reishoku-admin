"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ITEM_ARRIVAL_STATUSES,
  ITEM_ARRIVAL_PILL_CLASS,
  parseItemArrivalStatuses,
} from "@/lib/item-arrival-shared";
import { TogglePill } from "@/components/ui/toggle-pill";

// Same toggle-button feel as ReviewStatusSelector (review-status-selector.tsx),
// but a separate component rather than a generalization of it: that
// component's PATCH body hardcodes the "reviewStatus" field name, and
// keeping the two selectors independent means editing this one can never
// accidentally change reviewStatus's behavior/permissions.
export function ItemArrivalSelector({
  entryId,
  currentStatus,
}: {
  entryId: number;
  currentStatus: string;
}) {
  const [statuses, setStatuses] = useState<string[]>(parseItemArrivalStatuses(currentStatus));
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
        body: JSON.stringify({ itemArrivalStatus: newStatus }),
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
      {ITEM_ARRIVAL_STATUSES.map((rs) => {
        const isActive = statuses.includes(rs.value);
        return (
          <TogglePill
            key={rs.value}
            pressed={isActive}
            pending={saving && pendingValue === rs.value}
            disabled={saving}
            toneClassName={ITEM_ARRIVAL_PILL_CLASS[rs.value]}
            onClick={() => toggleStatus(rs.value)}
          >
            {rs.label}
          </TogglePill>
        );
      })}
    </div>
  );
}

// 本体は ui/badge.tsx に移った。import 先（reviews / entry-detail / entry-table）を変えずに済むよう再 export する
export { ItemArrivalBadge } from "@/components/ui/badge";
