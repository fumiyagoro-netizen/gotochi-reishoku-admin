"use client";

import { useState } from "react";
import Link from "next/link";
import { useRole } from "@/lib/role-context";

interface ImportResult {
  created: number;
  skippedDuplicate: number;
  skippedInvalid: number;
  total: number;
}

export default function ProspectsImportPage() {
  const { permissions } = useRole();
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    result?: ImportResult;
  } | null>(null);

  // Part of the 追客リスト feature — canManageProspects gates the page,
  // canUpload gates the import specifically (same convention as
  // src/app/contacts/import/page.tsx).
  if (!permissions.canManageProspects || !permissions.canUpload) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">インポート権限がありません</p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get("file") as File;
    if (!file || file.size === 0) return;

    setUploading(true);
    setResult(null);

    try {
      const res = await fetch("/api/prospects/import", {
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

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/prospects" className="text-sm text-gray-500 hover:text-gray-700">
          ← 追客リスト
        </Link>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-8">
        追客リスト Excelインポート
      </h2>

      <div className="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Excelファイル（.xlsx）を選択
              </span>
              <input
                type="file"
                name="file"
                accept=".xlsx"
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
              シート「メーカーリスト」（無い場合は先頭シート）を読み込みます。列はヘッダー名
              （メーカー名・県名・商品名・サイトで確認できる温度帯・確度・補足・URL）で対応付けます。
              メーカー名＋商品名が既存データと一致する行はスキップされ、コンタクト状況・担当者・
              連絡先・備考・メモ欄など運用中の入力内容が上書きされることはありません。
            </p>
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
            <p>{result.message}</p>
            {result.result && (
              <p className="mt-1 text-xs opacity-80">
                （内訳: 重複スキップ {result.result.skippedDuplicate}件 / メーカー名未入力スキップ{" "}
                {result.result.skippedInvalid}件）
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
