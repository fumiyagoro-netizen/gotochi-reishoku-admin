"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PRIZE_LEVELS = ["最高金賞", "金賞", "銀賞", "銅賞"];

const PRIZE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  最高金賞: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-300" },
  金賞: { bg: "bg-yellow-50", text: "text-yellow-800", border: "border-yellow-300" },
  銀賞: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-400" },
  銅賞: { bg: "bg-orange-50", text: "text-orange-800", border: "border-orange-300" },
};

export function PrizeSelector({
  entryId,
  currentPrize,
}: {
  entryId: number;
  currentPrize: string;
}) {
  const [prize, setPrize] = useState(currentPrize);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function setPrizeLevel(level: string) {
    const newLevel = level === prize ? "" : level;
    setSaving(true);
    try {
      const res = await fetch(`/api/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prizeLevel: newLevel }),
      });
      const data = await res.json();
      if (data.success) {
        setPrize(newLevel);
        setOpen(false);
        router.refresh();
      }
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  const colors = prize ? PRIZE_COLORS[prize] : null;

  return (
    <div className="relative">
      {prize ? (
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-3 py-1.5 ${colors!.bg} ${colors!.text} border ${colors!.border} text-sm font-bold rounded-full`}
          >
            🏆 {prize}
          </span>
          <button
            onClick={() => setOpen(!open)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            変更
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1 px-3 py-1.5 border border-dashed border-gray-300 text-sm text-gray-500 rounded-full hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          🏆 受賞を設定
        </button>
      )}

      {open && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-2 z-10 min-w-[180px]">
          {PRIZE_LEVELS.map((level) => {
            const c = PRIZE_COLORS[level];
            const isSelected = prize === level;
            return (
              <button
                key={level}
                onClick={() => setPrizeLevel(level)}
                disabled={saving}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  isSelected
                    ? `${c.bg} ${c.text}`
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span
                  className={`w-3 h-3 rounded-full border-2 ${
                    isSelected ? `${c.border} ${c.bg}` : "border-gray-300"
                  }`}
                />
                {level}
                {isSelected && <span className="ml-auto text-xs">✓</span>}
              </button>
            );
          })}
          {prize && (
            <button
              onClick={() => setPrizeLevel("")}
              disabled={saving}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors mt-1 border-t border-gray-100 pt-2"
            >
              受賞を取り消す
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PrizeBadge({ prizeLevel }: { prizeLevel: string }) {
  if (!prizeLevel) return null;
  const colors = PRIZE_COLORS[prizeLevel];
  if (!colors) return null;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 ${colors.bg} ${colors.text} border ${colors.border} text-xs font-bold rounded-full`}
    >
      🏆 {prizeLevel}
    </span>
  );
}
