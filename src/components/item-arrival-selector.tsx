"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ITEM_ARRIVAL_STATUSES,
  ITEM_ARRIVAL_COLORS,
  parseItemArrivalStatuses,
} from "@/lib/item-arrival-shared";

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
  const router = useRouter();

  async function toggleStatus(value: string) {
    const current = new Set(statuses);
    if (current.has(value)) {
      current.delete(value);
    } else {
      current.add(value);
    }
    const newStatus = Array.from(current).join(",");
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
    <div className="flex items-center gap-2">
      {ITEM_ARRIVAL_STATUSES.map((rs) => {
        const isActive = statuses.includes(rs.value);
        const colors = ITEM_ARRIVAL_COLORS[rs.value];
        return (
          <button
            key={rs.value}
            onClick={() => toggleStatus(rs.value)}
            disabled={saving}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-full border transition-colors disabled:opacity-50 ${
              isActive
                ? `${colors.bg} ${colors.text} ${colors.border}`
                : "border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600"
            }`}
          >
            {rs.icon} {rs.label}
            {isActive && <span className="ml-1">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

export function ItemArrivalBadge({ status }: { status: string }) {
  const active = parseItemArrivalStatuses(status);
  if (active.length === 0) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {active.map((s) => {
        const rs = ITEM_ARRIVAL_STATUSES.find((r) => r.value === s);
        if (!rs) return null;
        const colors = ITEM_ARRIVAL_COLORS[rs.value];
        return (
          <span
            key={s}
            className={`inline-flex items-center px-2.5 py-0.5 ${colors.bg} ${colors.text} border ${colors.border} text-xs font-bold rounded-full`}
          >
            {rs.icon} {rs.label}
          </span>
        );
      })}
    </div>
  );
}
