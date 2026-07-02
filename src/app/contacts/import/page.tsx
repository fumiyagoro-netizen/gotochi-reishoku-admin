"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRole } from "@/lib/role-context";

interface ContactListRow {
  id: number;
  name: string;
}

function ImportForm() {
  const { permissions } = useRole();
  const [lists, setLists] = useState<ContactListRow[]>([]);
  const [listId, setListId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [importingEntries, setImportingEntries] = useState(false);
  const [entryResult, setEntryResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/contacts/lists")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setLists(data.lists);
      });
  }, []);

  if (!permissions.canUpload) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-500">インポート権限がありません</p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get("csv") as File;
    if (!file || file.size === 0) return;

    if (listId) formData.set("listId", listId);

    setUploading(true);
    setResult(null);

    try {
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ success: false, message: "アップロードに失敗しました" });
    } finally {
      setUploading(false);
    }
  }

  async function handleImportEntries() {
    setImportingEntries(true);
    setEntryResult(null);
    try {
      const res = await fetch("/api/contacts/import-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setEntryResult(data);
    } catch {
      setEntryResult({ success: false, message: "取り込みに失敗しました" });
    } finally {
      setImportingEntries(false);
    }
  }

  return (
    <div className="max-w-xl space-y-8">
      {/* CSV Import */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">CSVファイルからインポート</h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                CSVファイルを選択
              </span>
              <input
                type="file"
                name="csv"
                accept=".csv"
                className="mt-2 block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-medium
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  cursor-pointer"
              />
            </label>
            <p className="mt-2 text-xs text-gray-400">
              列: email（必須）, name, companyName, phone
            </p>

            <label className="block mt-4">
              <span className="text-sm font-medium text-gray-700">
                追加先のリスト（任意）
              </span>
              <select
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                className="mt-2 block w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">リストに追加しない</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium
              hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? "アップロード中..." : "アップロード"}
          </button>
        </form>

        {result && (
          <div
            className={`mt-6 p-4 rounded-lg ${
              result.success
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {result.message}
          </div>
        )}
      </div>

      {/* Import from Entries */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">既存応募者を取り込む</h3>
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <p className="text-sm text-gray-600 mb-4">
            <strong>全年度</strong>のエントリーをメールアドレスで名寄せし、連絡先として取り込みます。
            同じ担当者は1件にまとまり、年度ごとに「&lt;年度&gt; 応募者」リスト（絞り込み用）へ自動振り分けされます。
          </p>
          <p className="text-xs text-gray-400 mb-4">
            ※ 今後の新規エントリーは自動で連絡先に追加されます。この取り込みは既存分の一括登録用です。
          </p>
          <button
            onClick={handleImportEntries}
            disabled={importingEntries}
            className="w-full py-3 px-4 bg-gray-800 text-white rounded-lg font-medium
              hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {importingEntries ? "取り込み中..." : "全年度の応募者を取り込む"}
          </button>
        </div>

        {entryResult && (
          <div
            className={`mt-6 p-4 rounded-lg ${
              entryResult.success
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {entryResult.message}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ContactsImportPage() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/contacts" className="text-sm text-gray-500 hover:text-gray-700">
          ← 連絡先一覧
        </Link>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-8">
        連絡先インポート
      </h2>
      <Suspense>
        <ImportForm />
      </Suspense>
    </div>
  );
}
