"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { FieldType, FormField } from "@/lib/form";

interface ContactList {
  id: number;
  name: string;
}

export interface FormData {
  id?: number;
  slug: string;
  title: string;
  description: string;
  status: string;
  fields: FormField[];
  targetListId: number | null;
  requireOptIn: boolean;
  thankYouMessage: string;
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "一行テキスト" },
  { value: "textarea", label: "複数行テキスト" },
  { value: "email", label: "メールアドレス" },
  { value: "tel", label: "電話番号" },
  { value: "number", label: "数値" },
  { value: "radio", label: "ラジオボタン（単一選択）" },
  { value: "checkbox", label: "チェックボックス（複数選択）" },
  { value: "select", label: "プルダウン" },
  { value: "date", label: "日付" },
  { value: "file", label: "ファイル添付" },
];

const MAP_TO_OPTIONS: { value: FormField["mapTo"] | ""; label: string }[] = [
  { value: "", label: "なし" },
  { value: "email", label: "メールアドレス" },
  { value: "name", label: "名前" },
  { value: "companyName", label: "企業名" },
  { value: "phone", label: "電話番号" },
];

const HAS_OPTIONS: FieldType[] = ["radio", "checkbox", "select"];

function newFieldId(): string {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const EMPTY_FORM: FormData = {
  slug: "",
  title: "",
  description: "",
  status: "draft",
  fields: [],
  targetListId: null,
  requireOptIn: false,
  thankYouMessage: "",
};

export function FormBuilder({ initial }: { initial?: FormData }) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<FormData>(initial || EMPTY_FORM);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchLists = useCallback(async () => {
    const res = await fetch("/api/contacts/lists");
    const data = await res.json();
    if (data.success) setLists(data.lists);
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const publicUrl = form.slug ? `${typeof window !== "undefined" ? window.location.origin : ""}/f/${form.slug}` : "";

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addField() {
    const field: FormField = {
      id: newFieldId(),
      type: "text",
      label: "",
      required: false,
    };
    setForm((prev) => ({ ...prev, fields: [...prev.fields, field] }));
  }

  function updateField(index: number, patch: Partial<FormField>) {
    setForm((prev) => {
      const fields = [...prev.fields];
      fields[index] = { ...fields[index], ...patch };
      return { ...prev, fields };
    });
  }

  function removeField(index: number) {
    setForm((prev) => ({ ...prev, fields: prev.fields.filter((_, i) => i !== index) }));
  }

  function moveField(index: number, direction: -1 | 1) {
    setForm((prev) => {
      const fields = [...prev.fields];
      const target = index + direction;
      if (target < 0 || target >= fields.length) return prev;
      [fields[index], fields[target]] = [fields[target], fields[index]];
      return { ...prev, fields };
    });
  }

  async function handleCopyUrl() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available; ignore
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(isEdit ? `/api/forms/${form.id}` : "/api/forms", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: form.slug,
          title: form.title,
          description: form.description,
          status: form.status,
          fields: form.fields,
          targetListId: form.targetListId,
          requireOptIn: form.requireOptIn,
          thankYouMessage: form.thankYouMessage,
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push("/forms");
        router.refresh();
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
    if (!isEdit) return;
    if (!confirm(`「${form.title}」を削除しますか？回答データもすべて削除されます。`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/forms/${form.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        router.push("/forms");
        router.refresh();
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
    <form onSubmit={handleSubmit} className="max-w-3xl">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-4">
        <h3 className="text-base font-bold text-gray-900">基本情報</h3>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">タイトル</span>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">説明</span>
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={3}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">状態</span>
            <select
              value={form.status}
              onChange={(e) => update("status", e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="draft">下書き</option>
              <option value="published">公開</option>
              <option value="closed">受付終了</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">登録先リスト（任意）</span>
            <select
              value={form.targetListId ?? ""}
              onChange={(e) => update("targetListId", e.target.value ? parseInt(e.target.value) : null)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">なし</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">サンクスメッセージ</span>
          <textarea
            value={form.thankYouMessage}
            onChange={(e) => update("thankYouMessage", e.target.value)}
            rows={2}
            placeholder="送信ありがとうございました。（未入力の場合はこの既定文が使われます）"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.requireOptIn}
            onChange={(e) => update("requireOptIn", e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">メルマガ配信の同意を求める（同意した回答者のみ配信対象になります）</span>
        </label>

        {isEdit && (
          <div className="pt-2 border-t border-gray-100">
            <span className="text-sm font-medium text-gray-700 block mb-1">公開URL</span>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 truncate">
                {publicUrl || "(保存後に発行されます)"}
              </code>
              {publicUrl && (
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {copied ? "コピーしました" : "コピー"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">項目</h3>
          <button
            type="button"
            onClick={addField}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            + 項目を追加
          </button>
        </div>

        <div className="space-y-4">
          {form.fields.map((field, index) => (
            <FieldEditor
              key={field.id}
              field={field}
              index={index}
              total={form.fields.length}
              onChange={(patch) => updateField(index, patch)}
              onRemove={() => removeField(index)}
              onMove={(dir) => moveField(index, dir)}
            />
          ))}
          {form.fields.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">項目がありません。「+ 項目を追加」から追加してください。</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-red-600 hover:text-red-800 hover:underline disabled:opacity-50"
            >
              {deleting ? "削除中..." : "フォームを削除"}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/forms")}
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
  );
}

function FieldEditor({
  field,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  field: FormField;
  index: number;
  total: number;
  onChange: (patch: Partial<FormField>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const showOptions = HAS_OPTIONS.includes(field.type);
  const optionsText = (field.options || []).join("\n");

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1 pt-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            title="上へ"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            title="下へ"
          >
            ↓
          </button>
        </div>

        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-500">種類</span>
              <select
                value={field.type}
                onChange={(e) => onChange({ type: e.target.value as FieldType })}
                className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-500">ラベル</span>
              <input
                type="text"
                value={field.label}
                onChange={(e) => onChange({ label: e.target.value })}
                required
                className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          {showOptions && (
            <label className="block">
              <span className="text-xs font-medium text-gray-500">選択肢（改行またはカンマ区切り）</span>
              <textarea
                value={optionsText}
                onChange={(e) =>
                  onChange({
                    options: e.target.value
                      .split(/[\n,]/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                rows={3}
                className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          )}

          <div className="grid grid-cols-2 gap-3 items-end">
            <label className="block">
              <span className="text-xs font-medium text-gray-500">連絡先へのマッピング</span>
              <select
                value={field.mapTo || ""}
                onChange={(e) => onChange({ mapTo: (e.target.value || undefined) as FormField["mapTo"] })}
                className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MAP_TO_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => onChange({ required: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">必須項目にする</span>
            </label>
          </div>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="text-sm text-red-600 hover:text-red-800 hover:underline flex-shrink-0"
        >
          削除
        </button>
      </div>
    </div>
  );
}
