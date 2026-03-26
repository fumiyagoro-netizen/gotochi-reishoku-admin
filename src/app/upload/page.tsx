"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useRole } from "@/lib/role-context";

function UploadForm() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultYear = searchParams.get("year") || String(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const { permissions } = useRole();

  if (!permissions.canUpload) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-500">アップロード権限がありません</p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get("csv") as File;
    if (!file || file.size === 0) return;

    formData.set("year", selectedYear);

    setUploading(true);
    setResult(null);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResult(data);
      if (data.success) {
        setTimeout(
          () => router.push(`/entries?year=${selectedYear}`),
          1500
        );
      }
    } catch {
      setResult({ success: false, message: "アップロードに失敗しました" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-xl">
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
            エントリーデータのCSVファイルをアップロードしてください
          </p>

          <label className="block mt-4">
            <span className="text-sm font-medium text-gray-700">
              アップロード先の年度
            </span>
            <input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              min="2020"
              max="2099"
              className="mt-2 block w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </label>
          <p className="mt-1 text-xs text-gray-400">
            新しい年度を入力すると自動的に作成されます
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
          {result.message}
        </div>
      )}
    </div>
  );
}

export default function UploadPage() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-8">
        CSVアップロード
      </h2>
      <Suspense>
        <UploadForm />
      </Suspense>
    </div>
  );
}
