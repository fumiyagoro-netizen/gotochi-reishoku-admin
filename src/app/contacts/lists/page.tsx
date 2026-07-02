"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRole } from "@/lib/role-context";

interface ContactListRow {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  _count: { memberships: number };
}

export default function ContactListsPage() {
  const { permissions } = useRole();
  const [lists, setLists] = useState<ContactListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingList, setEditingList] = useState<ContactListRow | null>(null);

  const fetchLists = useCallback(async () => {
    const res = await fetch("/api/contacts/lists");
    const data = await res.json();
    if (data.success) setLists(data.lists);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/contacts" className="text-sm text-gray-500 hover:text-gray-700">
            ← 連絡先一覧
          </Link>
        </div>
      </div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          リスト管理
          <span className="text-base font-normal text-gray-500 ml-3">
            {lists.length}件
          </span>
        </h2>
        {permissions.canEdit && (
          <button
            onClick={() => { setEditingList(null); setShowForm(true); }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium
              hover:bg-blue-700 transition-colors"
          >
            + リスト追加
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">リスト名</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">説明</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">件数</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lists.map((list) => (
                <tr key={list.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <Link href={`/contacts?listId=${list.id}`} className="text-blue-600 hover:underline">
                      {list.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{list.description}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{list._count.memberships}件</td>
                  <td className="px-4 py-3">
                    {permissions.canEdit && (
                      <button
                        onClick={() => { setEditingList(list); setShowForm(true); }}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        編集
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {lists.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                    リストがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ListFormModal
          list={editingList}
          onClose={() => setShowForm(false)}
          onSaved={fetchLists}
        />
      )}
    </div>
  );
}

function ListFormModal({
  list,
  onClose,
  onSaved,
}: {
  list: ContactListRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { permissions } = useRole();
  const isEdit = !!list;
  const [name, setName] = useState(list?.name || "");
  const [description, setDescription] = useState(list?.description || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(
        isEdit ? `/api/contacts/lists/${list!.id}` : "/api/contacts/lists",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        }
      );
      const data = await res.json();
      if (data.success) {
        onSaved();
        onClose();
      } else {
        setError(data.message);
      }
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`「${list!.name}」を削除しますか？`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/contacts/lists/${list!.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        onSaved();
        onClose();
      } else {
        setError(data.message);
      }
    } catch {
      setError("削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {isEdit ? "リスト編集" : "リスト追加"}
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">リスト名</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">説明</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <div className="flex items-center justify-between pt-2">
            <div>
              {isEdit && permissions.canDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-sm text-red-600 hover:text-red-800 hover:underline disabled:opacity-50"
                >
                  {deleting ? "削除中..." : "リストを削除"}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg
                  hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg font-medium
                  hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
