"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PrizeBadge } from "./prize-selector";
import { ReviewBadge } from "./review-status-selector";
import { useRole } from "@/lib/role-context";

interface EntryRow {
  id: number;
  productName: string;
  companyName: string;
  productCategory: string;
  contactLastName: string;
  contactFirstName: string;
  answeredAt: string;
  prizeLevel: string;
  reviewStatus: string;
  images: { id: number; imageUrl: string }[];
}

const PRIZE_LEVELS = ["最高金賞", "金賞", "銀賞", "銅賞"];
const REVIEW_STATUSES = [
  { value: "first_passed", label: "1次審査通過" },
  { value: "second_passed", label: "2次審査通過" },
];

export function EntryTable({
  entries,
  year,
}: {
  entries: EntryRow[];
  year: number | null;
}) {
  const { permissions } = useRole();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"" | "prize" | "review">("");
  const [applying, setApplying] = useState(false);
  const router = useRouter();

  function toggleAll() {
    if (selected.size === entries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(entries.map((e) => e.id)));
    }
  }

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function applyPrize(prizeLevel: string) {
    setApplying(true);
    try {
      const res = await fetch("/api/entries/bulk-prize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryIds: Array.from(selected), prizeLevel }),
      });
      const data = await res.json();
      if (data.success) {
        setSelected(new Set());
        setBulkAction("");
        router.refresh();
      } else {
        alert(data.message);
      }
    } catch {
      alert("一括設定に失敗しました");
    } finally {
      setApplying(false);
    }
  }

  async function applyReview(reviewStatus: string) {
    setApplying(true);
    try {
      const res = await fetch("/api/entries/bulk-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryIds: Array.from(selected), reviewStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setSelected(new Set());
        setBulkAction("");
        router.refresh();
      } else {
        alert(data.message);
      }
    } catch {
      alert("一括設定に失敗しました");
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      {/* Bulk Action Bar */}
      {permissions.canSetPrize && selected.size > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-blue-700">
            {selected.size}件選択中
          </span>
          {bulkAction === "" && (
            <>
              <button
                onClick={() => setBulkAction("prize")}
                className="px-3 py-1.5 bg-amber-500 text-white text-sm rounded-lg font-medium
                  hover:bg-amber-600 transition-colors"
              >
                🏆 受賞を一括設定
              </button>
              <button
                onClick={() => setBulkAction("review")}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg font-medium
                  hover:bg-green-700 transition-colors"
              >
                ✅ 審査状況を一括設定
              </button>
            </>
          )}
          {bulkAction === "prize" && (
            <div className="flex items-center gap-2 flex-wrap">
              {PRIZE_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => applyPrize(level)}
                  disabled={applying}
                  className="px-3 py-1.5 border border-amber-300 bg-white text-sm rounded-lg font-medium
                    text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition-colors"
                >
                  {level}
                </button>
              ))}
              <button
                onClick={() => applyPrize("")}
                disabled={applying}
                className="px-3 py-1.5 border border-red-300 bg-white text-sm rounded-lg
                  text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                取り消す
              </button>
              <button
                onClick={() => setBulkAction("")}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
              >
                キャンセル
              </button>
            </div>
          )}
          {bulkAction === "review" && (
            <div className="flex items-center gap-2 flex-wrap">
              {REVIEW_STATUSES.map((rs) => (
                <button
                  key={rs.value}
                  onClick={() => applyReview(rs.value)}
                  disabled={applying}
                  className="px-3 py-1.5 border border-green-300 bg-white text-sm rounded-lg font-medium
                    text-green-700 hover:bg-green-50 disabled:opacity-50 transition-colors"
                >
                  {rs.label}
                </button>
              ))}
              <button
                onClick={() => applyReview("")}
                disabled={applying}
                className="px-3 py-1.5 border border-red-300 bg-white text-sm rounded-lg
                  text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                取り消す
              </button>
              <button
                onClick={() => setBulkAction("")}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
              >
                キャンセル
              </button>
            </div>
          )}
          <button
            onClick={() => { setSelected(new Set()); setBulkAction(""); }}
            className="ml-auto text-sm text-gray-500 hover:text-gray-700"
          >
            選択解除
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {permissions.canSetPrize && (
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={entries.length > 0 && selected.size === entries.length}
                    onChange={toggleAll}
                    className="rounded border-gray-300"
                  />
                </th>
              )}
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">写真</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">商品名</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">企業名</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">カテゴリ</th>
              {permissions.canSeePrivateInfo && (
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">担当者</th>
              )}
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">審査状況</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">回答日</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className={`hover:bg-gray-50 transition-colors ${
                  selected.has(entry.id) ? "bg-blue-50/50" : ""
                }`}
              >
                {permissions.canSetPrize && (
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(entry.id)}
                      onChange={() => toggle(entry.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  {entry.images[0] ? (
                    <img
                      src={`/api/images/${entry.images[0].id}`}
                      alt=""
                      className="w-12 h-12 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                      No img
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/entries/${entry.id}${year ? `?year=${year}` : ""}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {entry.productName}
                    </Link>
                    <PrizeBadge prizeLevel={entry.prizeLevel} />
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{entry.companyName}</td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                    {entry.productCategory || "未分類"}
                  </span>
                </td>
                {permissions.canSeePrivateInfo && (
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {entry.contactLastName} {entry.contactFirstName}
                  </td>
                )}
                <td className="px-4 py-3">
                  <ReviewBadge status={entry.reviewStatus} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {entry.answeredAt.split(" ")[0]}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  エントリーデータがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
