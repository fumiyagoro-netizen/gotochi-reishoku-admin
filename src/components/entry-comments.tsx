"use client";

import { useState } from "react";
import { useRole } from "@/lib/role-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field-controls";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineConfirm } from "@/components/ui/inline-confirm";

export interface EntryCommentData {
  id: number;
  userId: number | null;
  authorName: string;
  body: string;
  createdAt: string; // ISO string
}

// Pinned to Asia/Tokyo rather than left to the viewer's clock: this component
// is server-rendered before it hydrates, so an unpinned format would render in
// the server's UTC and then shift on hydration — and a reviewer reading from
// another timezone would see a different time than their colleagues.
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

export function EntryComments({
  entryId,
  comments: initialComments,
  currentUserId,
}: {
  entryId: number;
  comments: EntryCommentData[];
  currentUserId?: number;
}) {
  const { role, permissions } = useRole();
  const canPost = permissions.canReviewComment;

  const [comments, setComments] = useState<EntryCommentData[]>(initialComments);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handlePost() {
    if (!body.trim()) return;
    setPosting(true);
    setError("");
    try {
      const res = await fetch(`/api/entries/${entryId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (data.success) {
        setComments((prev) => [data.comment, ...prev]);
        setBody("");
      } else {
        setError(data.message || "投稿に失敗しました");
      }
    } catch {
      setError("投稿に失敗しました");
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(commentId: number) {
    setDeletingId(commentId);
    try {
      const res = await fetch(`/api/entries/${entryId}/comments/${commentId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      } else {
        alert(data.message || "削除に失敗しました");
      }
    } catch {
      alert("削除に失敗しました");
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  return (
    <Card padding="none" as="section">
      {/* CardHeader は h2 固定なので、商品名 h2 の下位になる h3 を同じ見た目で手で組む */}
      <div className="border-b border-line px-5 py-3.5">
        <h3 className="text-sm font-semibold text-ink">審査コメント</h3>
      </div>

      <div className="p-5">
        {canPost && (
          <div className="mb-5">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="審査コメントを入力..."
            />
            {error && (
              <div className="mt-2">
                <Alert tone="danger" compact>
                  {error}
                </Alert>
              </div>
            )}
            <div className="flex justify-end mt-2">
              <Button
                variant="primary"
                onClick={handlePost}
                disabled={posting || !body.trim()}
                loading={posting}
              >
                {posting ? "投稿中..." : "投稿"}
              </Button>
            </div>
          </div>
        )}

        {comments.length === 0 ? (
          <EmptyState size="sm" title="まだコメントはありません" />
        ) : (
          <ul className="divide-y divide-line">
            {comments.map((comment) => {
              const canDelete =
                role === "admin" || (currentUserId != null && comment.userId === currentUserId);
              return (
                <li key={comment.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-medium text-ink">
                        {comment.authorName || "不明なユーザー"}
                      </span>
                      <span className="text-caption text-ink-subtle">
                        {formatDateTime(comment.createdAt)}
                      </span>
                    </div>
                    {canDelete &&
                      (confirmingId === comment.id ? (
                        <div className="shrink-0">
                          <InlineConfirm
                            message="削除しますか？"
                            // 実行中の文言は旧来の「削除中...」のまま（スピナーは InlineConfirm 側）
                            confirmLabel={deletingId === comment.id ? "削除中..." : "削除する"}
                            onConfirm={() => handleDelete(comment.id)}
                            onCancel={() => setConfirmingId(null)}
                            loading={deletingId === comment.id}
                          />
                        </div>
                      ) : (
                        <Button
                          variant="dangerGhost"
                          size="sm"
                          className="shrink-0"
                          onClick={() => setConfirmingId(comment.id)}
                        >
                          削除
                        </Button>
                      ))}
                  </div>
                  <p className="text-sm text-ink whitespace-pre-wrap mt-1">{comment.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
