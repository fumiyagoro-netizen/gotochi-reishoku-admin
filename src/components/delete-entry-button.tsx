"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteEntryButton({ entryId }: { entryId: number }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/entries/${entryId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        router.push("/entries");
        router.refresh();
      } else {
        alert(data.message || "削除に失敗しました");
      }
    } catch {
      alert("削除に失敗しました");
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-red-600">本当に削除しますか？</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700
            disabled:opacity-50 transition-colors"
        >
          {deleting ? "削除中..." : "削除する"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-3 py-1.5 border border-gray-300 text-sm text-gray-600 rounded-lg
            hover:bg-gray-50 transition-colors"
        >
          キャンセル
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded-lg
        hover:bg-red-50 transition-colors"
    >
      削除
    </button>
  );
}
