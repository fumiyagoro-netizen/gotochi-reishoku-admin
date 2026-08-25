"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRole } from "@/lib/role-context";
import { formatYen } from "@/lib/invoice-shared";

interface InvoiceItemRow {
  id: number;
  name: string;
  unitPrice: number;
  sortOrder: number;
  isActive: boolean;
}

export default function InvoiceItemsPage() {
  const { permissions } = useRole();
  const [items, setItems] = useState<InvoiceItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InvoiceItemRow | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/invoice-items");
      const data = await res.json();
      if (data.success) setItems(data.items);
      else setErrorMsg(data.message || "取得に失敗しました");
    } catch (e) {
      setErrorMsg("通信エラー: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    // sortOrder を入れ替える。form-builder.tsx の moveField と違いこちらは
    // 保存済みデータなので、画面上の並び替えと同時に2件 PATCH してサーバー側
    // の並び順も揃える。
    await Promise.all([
      fetch(`/api/invoice-items/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: b.sortOrder }),
      }),
      fetch(`/api/invoice-items/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: a.sortOrder }),
      }),
    ]);
    fetchItems();
  }

  if (!permissions.canManageInvoices) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">閲覧権限がありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/invoices" className="text-sm text-gray-500 hover:text-gray-700">
          ← 請求書一覧
        </Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          請求項目マスタ
          <span className="text-base font-normal text-gray-500 ml-3">{items.length}件</span>
        </h2>
        <button
          onClick={() => { setEditingItem(null); setShowForm(true); }}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium
            hover:bg-blue-700 transition-colors"
        >
          + 新規追加
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg break-words">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">品名</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">単価（税別）</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">状態</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-40">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, i) => (
                <tr key={item.id} className={item.isActive ? "" : "opacity-50"}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right whitespace-nowrap">
                    {formatYen(item.unitPrice)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                        item.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {item.isActive ? "有効" : "無効"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => moveItem(i, -1)}
                        disabled={i === 0}
                        className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        title="上へ"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveItem(i, 1)}
                        disabled={i === items.length - 1}
                        className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        title="下へ"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => { setEditingItem(item); setShowForm(true); }}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        編集
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                    請求項目マスタがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <InvoiceItemFormModal
          item={editingItem}
          onClose={() => { setShowForm(false); setEditingItem(null); }}
          onSaved={fetchItems}
        />
      )}
    </div>
  );
}

function InvoiceItemFormModal({
  item,
  onClose,
  onSaved,
}: {
  item: InvoiceItemRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;
  const [name, setName] = useState(item?.name || "");
  const [unitPrice, setUnitPrice] = useState(item?.unitPrice ?? 0);
  const [isActive, setIsActive] = useState(item?.isActive ?? true);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(isEdit ? `/api/invoice-items/${item!.id}` : "/api/invoice-items", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, unitPrice, isActive }),
      });
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
    if (!item) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/invoice-items/${item.id}`, { method: "DELETE" });
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
      setConfirmingDelete(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {isEdit ? "請求項目編集" : "請求項目追加"}
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">品名</span>
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
            <span className="text-sm font-medium text-gray-700">
              単価（税別）
              <span className="ml-1 text-xs text-gray-400 font-normal">マイナス可（割引など）</span>
            </span>
            <input
              type="number"
              value={unitPrice}
              onChange={(e) => setUnitPrice(parseInt(e.target.value, 10) || 0)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">
              有効（請求書作成時の選択肢に表示する）
            </span>
          </label>

          <div className="flex items-center justify-between gap-2 pt-2">
            <div>
              {isEdit && (
                confirmingDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-600">削除しますか？</span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg
                        hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? "削除中..." : "削除する"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="px-3 py-1.5 border border-gray-300 text-sm text-gray-600 rounded-lg hover:bg-gray-50"
                    >
                      キャンセル
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50"
                  >
                    削除
                  </button>
                )
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg font-medium
                  hover:bg-blue-700 disabled:opacity-50"
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
