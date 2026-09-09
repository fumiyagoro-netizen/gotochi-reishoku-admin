"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { isDisplayField } from "@/lib/form-shared";
import type { FormField, FormAnswers } from "@/lib/form-shared";
import { useRole } from "@/lib/role-context";

interface FormInfo {
  id: number;
  title: string;
  slug: string;
  fields: FormField[];
}

interface Submission {
  id: number;
  answers: FormAnswers;
  contact: { id: number; email: string; name: string } | null;
  createdAt: string;
}

function isFileUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//.test(value);
}

export default function FormSubmissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { permissions } = useRole();
  const [form, setForm] = useState<FormInfo | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // 見出し・説明文・画像はフォーム上の飾りで回答を持たないため、列にしない。
  // Excel出力側 (api/forms/[id]/submissions/export) も同じ条件で外している。
  const answerFields = (form?.fields || []).filter((f) => !isDisplayField(f));

  useEffect(() => {
    fetch(`/api/forms/${id}/submissions`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setForm(data.form);
          setSubmissions(data.submissions);
        } else {
          setError(data.message);
        }
        setLoading(false);
      });
  }, [id]);

  async function handleDelete(submissionId: number) {
    if (
      !window.confirm(
        "この回答を削除します。添付ファイルも一緒に削除され、元に戻せません。よろしいですか？"
      )
    ) {
      return;
    }
    setDeletingId(submissionId);
    try {
      const res = await fetch(`/api/forms/${id}/submissions/${submissionId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
      } else {
        setError(data.message || "削除に失敗しました");
      }
    } catch {
      setError("削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  }

  function renderValue(field: FormField, value: string | string[] | undefined) {
    if (value === undefined || value === null || value === "") return "-";

    if (field.type === "file") {
      const urls = Array.isArray(value) ? value : [value];
      return (
        <div className="flex flex-col gap-1">
          {urls.filter(isFileUrl).map((url, i) => (
            <a
              key={i}
              /* blob の URL は private なので直リンクでは開けない。
                 認証を通す /api/forms/attachment 経由にする。 */
              href={`/api/forms/attachment?url=${encodeURIComponent(url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-xs"
            >
              添付ファイル{urls.length > 1 ? ` ${i + 1}` : ""}
            </a>
          ))}
        </div>
      );
    }

    return Array.isArray(value) ? value.join(", ") : value;
  }

  // Part of the forms feature — gated the same way as /forms. The API
  // enforces this too; this only keeps the page from rendering an empty
  // shell (or a "回答がありません" message) for roles that must not reach it.
  if (!permissions.canManageForms) {
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
        <Link href="/forms" className="text-sm text-gray-500 hover:text-gray-700">
          ← フォーム一覧
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {form ? `${form.title} の回答` : "回答一覧"}
          <span className="text-base font-normal text-gray-500 ml-3">{submissions.length}件</span>
        </h2>
        {form && (
          <a
            href={`/api/forms/${id}/submissions/export`}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium
              hover:bg-blue-700 transition-colors"
          >
            Excelでダウンロード
          </a>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">受信日時</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">連絡先</th>
                {answerFields.map((field) => (
                  <th key={field.id} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    {field.label}
                  </th>
                ))}
                {permissions.canDelete && <th className="w-16" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submissions.map((submission) => (
                <tr key={submission.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {/* Pinned to Asia/Tokyo so it matches the Excel export and
                        doesn't shift between server render and hydration. */}
                    {new Date(submission.createdAt).toLocaleString("ja-JP", {
                      timeZone: "Asia/Tokyo",
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                    {submission.contact ? (
                      <div>
                        <div>{submission.contact.email}</div>
                        {submission.contact.name && (
                          <div className="text-xs text-gray-400">{submission.contact.name}</div>
                        )}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  {answerFields.map((field) => (
                    <td key={field.id} className="px-4 py-3 text-sm text-gray-700 max-w-xs">
                      {renderValue(field, submission.answers[field.id])}
                    </td>
                  ))}
                  {permissions.canDelete && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleDelete(submission.id)}
                        disabled={deletingId === submission.id}
                        className="text-xs text-red-600 hover:text-red-800 hover:underline disabled:opacity-50"
                      >
                        {deletingId === submission.id ? "削除中..." : "削除"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {submissions.length === 0 && (
                <tr>
                  <td colSpan={2 + answerFields.length + (permissions.canDelete ? 1 : 0)} className="px-4 py-12 text-center text-gray-400">
                    回答がありません
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
