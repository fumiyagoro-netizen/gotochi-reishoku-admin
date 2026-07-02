"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import type { FormField, FormAnswers } from "@/lib/form";

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
  const [form, setForm] = useState<FormInfo | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  function renderValue(field: FormField, value: string | string[] | undefined) {
    if (value === undefined || value === null || value === "") return "-";

    if (field.type === "file") {
      const urls = Array.isArray(value) ? value : [value];
      return (
        <div className="flex flex-col gap-1">
          {urls.filter(isFileUrl).map((url, i) => (
            <a
              key={i}
              href={url}
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
                {(form?.fields || []).map((field) => (
                  <th key={field.id} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submissions.map((submission) => (
                <tr key={submission.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {new Date(submission.createdAt).toLocaleString("ja-JP")}
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
                  {(form?.fields || []).map((field) => (
                    <td key={field.id} className="px-4 py-3 text-sm text-gray-700 max-w-xs">
                      {renderValue(field, submission.answers[field.id])}
                    </td>
                  ))}
                </tr>
              ))}
              {submissions.length === 0 && (
                <tr>
                  <td colSpan={2 + (form?.fields.length || 0)} className="px-4 py-12 text-center text-gray-400">
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
