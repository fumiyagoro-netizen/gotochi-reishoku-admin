"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const REVIEW_STATUSES = [
  { value: "first_passed", label: "1次審査通過", icon: "①" },
  { value: "second_passed", label: "2次審査通過", icon: "②" },
];

const REVIEW_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  first_passed: { bg: "bg-green-50", text: "text-green-700", border: "border-green-300" },
  second_passed: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-300" },
};

export function ReviewStatusSelector({
  entryId,
  currentStatus,
}: {
  entryId: number;
  currentStatus: string;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function toggleStatus(value: string) {
    const newStatus = value === status ? "" : value;
    setSaving(true);
    try {
      const res = await fetch(`/api/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus(newStatus);
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
      {REVIEW_STATUSES.map((rs) => {
        const isActive = status === rs.value;
        const colors = REVIEW_COLORS[rs.value];
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

export function ReviewBadge({ status }: { status: string }) {
  if (!status) return null;
  const rs = REVIEW_STATUSES.find((r) => r.value === status);
  if (!rs) return null;
  const colors = REVIEW_COLORS[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 ${colors.bg} ${colors.text} border ${colors.border} text-xs font-bold rounded-full`}
    >
      {rs.icon} {rs.label}
    </span>
  );
}
