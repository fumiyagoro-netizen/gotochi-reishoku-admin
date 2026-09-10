"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InlineConfirm } from "@/components/ui/inline-confirm";
import { Trash2 } from "@/components/ui/icons";

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

  // confirming の分岐はここに残し、確認段階の見た目だけ InlineConfirm に任せる
  if (confirming) {
    return (
      <InlineConfirm
        message="本当に削除しますか？"
        confirmLabel="削除する"
        // 実行中の文言は旧来の「削除中...」のまま
        loadingLabel="削除中..."
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
        loading={deleting}
      />
    );
  }

  return (
    <Button variant="dangerGhost" icon={<Trash2 />} onClick={() => setConfirming(true)}>
      削除
    </Button>
  );
}
