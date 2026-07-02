"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRole } from "@/lib/role-context";

interface FormRow {
  id: number;
  slug: string;
  title: string;
  status: string;
  createdAt: string;
  _count: { submissions: number };
}

const STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  published: "公開",
  closed: "受付終了",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  published: "bg-green-100 text-green-700",
  closed: "bg-orange-100 text-orange-700",
};

export default function FormsPage() {
  const { permissions } = useRole();
  const [forms, setForms] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchForms = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/forms");
    const data = await res.json();
    if (data.success) setForms(data.forms);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  async function handleDelete(form: FormRow) {
    if (!confirm(`「${form.title}」を削除しますか？回答データもすべて削除されます。`)) return;
    const res = await fetch(`/api/forms/${form.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      fetchForms();
    } else {
      alert(data.message);
    }
  }

  async function handleCopy(form: FormRow) {
    const url = `${window.location.origin}/f/${form.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(form.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          フォーム
          <span className="text-base font-normal text-gray-500 ml-3">{forms.length}件</span>
        </h2>
        {permissions.canEdit && (
          <Link
            href="/forms/new"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium
              hover:bg-blue-700 transition-colors"
          >
            + フォーム作成
          </Link>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">タイトル</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">公開URL</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">状態</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">回答数</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {forms.map((form) => (
                <tr key={form.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{form.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <code className="text-xs">/f/{form.slug}</code>
                      <button
                        onClick={() => handleCopy(form)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {copiedId === form.id ? "コピーしました" : "コピー"}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[form.status] || ""}`}>
                      {STATUS_LABELS[form.status] || form.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <Link href={`/forms/${form.id}/submissions`} className="text-blue-600 hover:underline">
                      {form._count.submissions}件
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link href={`/forms/${form.id}/submissions`} className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
                        回答を見る
                      </Link>
                      {permissions.canEdit && (
                        <Link href={`/forms/${form.id}/edit`} className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
                          編集
                        </Link>
                      )}
                      {permissions.canDelete && (
                        <button
                          onClick={() => handleDelete(form)}
                          className="text-sm text-red-600 hover:text-red-800 hover:underline"
                        >
                          削除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {forms.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                    フォームがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
