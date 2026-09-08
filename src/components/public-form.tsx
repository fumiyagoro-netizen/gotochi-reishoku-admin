"use client";

import { useState } from "react";
import { isDisplayField } from "@/lib/form-shared";
import type { FormField, FormAnswers } from "@/lib/form-shared";

export function PublicForm({
  slug,
  fields,
  requireOptIn,
  thankYouMessage,
}: {
  slug: string;
  fields: FormField[];
  requireOptIn: boolean;
  thankYouMessage: string;
}) {
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [optIn, setOptIn] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);

  function setValue(fieldId: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }

  function toggleCheckbox(fieldId: string, option: string) {
    setAnswers((prev) => {
      const current = Array.isArray(prev[fieldId]) ? (prev[fieldId] as string[]) : [];
      const next = current.includes(option)
        ? current.filter((v) => v !== option)
        : [...current, option];
      return { ...prev, [fieldId]: next };
    });
  }

  async function handleFileChange(fieldId: string, file: File | null) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, [fieldId]: "ファイルサイズは10MB以下にしてください" }));
      return;
    }

    setUploading((prev) => ({ ...prev, [fieldId]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/forms/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "アップロードに失敗しました");
      setValue(fieldId, data.blobUrl);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [fieldId]: err instanceof Error ? err.message : "アップロードに失敗しました",
      }));
    } finally {
      setUploading((prev) => ({ ...prev, [fieldId]: false }));
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    for (const field of fields) {
      if (isDisplayField(field)) continue;
      if (!field.required) continue;
      const value = answers[field.id];
      if (field.type === "checkbox") {
        if (!Array.isArray(value) || value.length === 0) errs[field.id] = "必須項目です";
      } else if (!value || !String(value).trim()) {
        errs[field.id] = "必須項目です";
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      const payload: FormAnswers = { ...answers };
      if (requireOptIn) {
        payload["__optin"] = optIn ? "true" : "false";
      }

      const res = await fetch(`/api/forms/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "送信に失敗しました");
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-gray-700 whitespace-pre-wrap max-w-md mx-auto">{thankYouMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-700 text-sm">{submitError}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-5">
        {fields.map((field) => (
          <FieldInput
            key={field.id}
            field={field}
            value={answers[field.id]}
            error={errors[field.id]}
            uploading={!!uploading[field.id]}
            onChange={(v) => setValue(field.id, v)}
            onToggleCheckbox={(opt) => toggleCheckbox(field.id, opt)}
            onFileChange={(file) => handleFileChange(field.id, file)}
          />
        ))}

        {requireOptIn && (
          <div className="pt-2 border-t border-gray-100">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={optIn}
                onChange={(e) => setOptIn(e.target.checked)}
                className="rounded border-gray-300 w-5 h-5"
              />
              <span className="text-sm font-medium">メルマガ配信に同意する</span>
            </label>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-4 bg-blue-600 text-white text-lg font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {submitting ? "送信中..." : "送信する"}
      </button>
    </form>
  );
}

function FieldInput({
  field,
  value,
  error,
  uploading,
  onChange,
  onToggleCheckbox,
  onFileChange,
}: {
  field: FormField;
  value: string | string[] | undefined;
  error?: string;
  uploading: boolean;
  onChange: (v: string) => void;
  onToggleCheckbox: (option: string) => void;
  onFileChange: (file: File | null) => void;
}) {
  const strValue = typeof value === "string" ? value : "";
  const arrValue = Array.isArray(value) ? value : [];

  // 表示専用ブロックは入力欄ではないので <label> で包まない（包むとクリックが
  // 直後の入力欄にフォーカスを移してしまい、押せる要素のように見える）。
  if (field.type === "heading") {
    return (
      <h3 className="text-base font-bold text-gray-900 pt-2 border-t border-gray-100 first:border-t-0 first:pt-0">
        {field.label}
      </h3>
    );
  }

  if (field.type === "paragraph") {
    return (
      <div>
        {field.label && (
          <p className="text-sm font-medium text-gray-900 mb-1">{field.label}</p>
        )}
        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
          {field.content}
        </p>
      </div>
    );
  }

  if (field.type === "image") {
    if (!field.content) return null;
    return (
      <figure>
        <img
          src={field.content}
          alt={field.label || ""}
          className="w-full max-w-lg rounded-lg border border-gray-200"
        />
        {field.label && (
          <figcaption className="text-xs text-gray-500 mt-1">{field.label}</figcaption>
        )}
      </figure>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </label>
      {field.hint && (
        <p className="text-xs text-gray-500 mb-1.5 whitespace-pre-wrap">{field.hint}</p>
      )}

      {field.type === "textarea" ? (
        <textarea
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical ${
            error ? "border-red-400 bg-red-50" : "border-gray-300"
          }`}
        />
      ) : field.type === "select" ? (
        <select
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            error ? "border-red-400 bg-red-50" : "border-gray-300"
          }`}
        >
          <option value="">選択してください</option>
          {(field.options || []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : field.type === "radio" ? (
        <div className="space-y-2">
          {(field.options || []).map((o) => (
            <label key={o} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={strValue === o} onChange={() => onChange(o)} className="text-blue-600" />
              <span className="text-sm">{o}</span>
            </label>
          ))}
        </div>
      ) : field.type === "checkbox" ? (
        <div className="flex flex-wrap gap-3">
          {(field.options || []).map((o) => (
            <label key={o} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={arrValue.includes(o)}
                onChange={() => onToggleCheckbox(o)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">{o}</span>
            </label>
          ))}
        </div>
      ) : field.type === "file" ? (
        <FileDropInput
          fieldId={field.id}
          uploading={uploading}
          uploaded={!!strValue}
          error={!!error}
          onFile={onFileChange}
        />
      ) : (
        <input
          type={field.type === "email" ? "email" : field.type === "tel" ? "tel" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            error ? "border-red-400 bg-red-50" : "border-gray-300"
          }`}
        />
      )}

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

/** ファイル添付欄。クリックしてもドラッグ&ドロップでも同じ 1 本の onFile に流す。
 *  <input type="file"> 自体は残したまま枠だけ被せている — キーボード操作と
 *  スクリーンリーダーはネイティブの input が引き受け、ドロップは枠が受ける。 */
function FileDropInput({
  fieldId,
  uploading,
  uploaded,
  error,
  onFile,
}: {
  fieldId: string;
  uploading: boolean;
  uploaded: boolean;
  error: boolean;
  onFile: (file: File | null) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");

  function take(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    onFile(file);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          // preventDefault しないとブラウザがファイルを開いてしまい、
          // 入力途中のフォームごと離脱することになる。
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer.files?.[0] || null);
        }}
        className={`rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragging
            ? "border-blue-400 bg-blue-50"
            : error
              ? "border-red-400 bg-red-50"
              : "border-gray-300 bg-gray-50"
        }`}
      >
        <p className="text-sm text-gray-600 mb-2">
          ここにファイルをドラッグ&ドロップ
        </p>
        <label
          htmlFor={`file-${fieldId}`}
          className="inline-block px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm
            text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
        >
          ファイルを選択
        </label>
        <input
          id={`file-${fieldId}`}
          type="file"
          onChange={(e) => take(e.target.files?.[0] || null)}
          className="sr-only"
        />
        <p className="text-xs text-gray-400 mt-2">10MBまで</p>
      </div>
      {uploading && <p className="text-xs text-gray-500 mt-1">アップロード中...</p>}
      {!uploading && uploaded && (
        <p className="text-xs text-green-600 mt-1">
          アップロード済み{fileName ? `: ${fileName}` : ""}
        </p>
      )}
    </div>
  );
}
