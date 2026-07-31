"use client";

import { useState } from "react";
import { useRole } from "@/lib/role-context";

export interface EntryCommentData {
  id: number;
  userId: number | null;
  authorName: string;
  body: string;
  createdAt: string; // ISO string
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
        審査コメント
      </h3>

      {canPost && (
        <div className="mb-5">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="審査コメントを入力..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
              focus:outline-none focus:border-blue-400"
          />
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          <div className="flex justify-end mt-2">
            <button
              onClick={handlePost}
              disabled={posting || !body.trim()}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700
                disabled:opacity-50 transition-colors"
            >
              {posting ? "投稿中..." : "投稿"}
            </button>
          </div>
        </div>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-gray-400">まだコメントはありません</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => {
            const canDelete =
              role === "admin" || (currentUserId != null && comment.userId === currentUserId);
            return (
              <li key={comment.id} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">
                      {comment.authorName || "不明なユーザー"}
                    </span>
                    <span className="text-xs text-gray-400">{formatDateTime(comment.createdAt)}</span>
                  </div>
                  {canDelete &&
                    (confirmingId === comment.id ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-red-600">削除しますか？</span>
                        <button
                          onClick={() => handleDelete(comment.id)}
                          disabled={deletingId === comment.id}
                          className="px-2 py-1 bg-red-600 text-white text-xs rounded
                            hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          {deletingId === comment.id ? "削除中..." : "削除する"}
                        </button>
                        <button
                          onClick={() => setConfirmingId(null)}
                          className="px-2 py-1 border border-gray-300 text-xs text-gray-600 rounded
                            hover:bg-gray-50 transition-colors"
                        >
                          キャンセル
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingId(comment.id)}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline shrink-0"
                      >
                        削除
                      </button>
                    ))}
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{comment.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
