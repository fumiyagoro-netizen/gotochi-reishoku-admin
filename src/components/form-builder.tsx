"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formImageSrc, isDisplayField } from "@/lib/form-shared";
import type { DisplayFieldType, FieldType, FormField } from "@/lib/form-shared";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldsetTitle } from "@/components/ui/field";
import { Checkbox, FileInput, Input, Select, Textarea } from "@/components/ui/field-controls";
import { IconButton } from "@/components/ui/icon-button";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  // 表示専用ブロックの目印。Image / Text は DOM のグローバル名と被るので *Icon 別名で取る
  HeadingIcon,
  ImageIcon,
  Loader2,
  Plus,
  TextIcon,
  Trash2,
  type LucideIcon,
} from "@/components/ui/icons";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";

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
  autoReplyEnabled: boolean;
  autoReplySubject: string;
  autoReplyBody: string;
  notifyEmails: string;
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

// 入力欄ではなく、フォーム上に文章や画像を置くためのブロック。種類セレクトでは
// optgroup で入力項目と分けて見せる（回答が増えるものと増えないものの区別が
// 一覧で付かないと、必須設定などを誤って探しにいくため）。
const DISPLAY_TYPES: { value: FieldType; label: string }[] = [
  { value: "heading", label: "見出し" },
  { value: "paragraph", label: "説明文" },
  { value: "image", label: "画像" },
];

// 表示専用ブロックのカード左肩に出す目印。入力項目のカードと一目で見分けるため
const DISPLAY_ICONS: Record<DisplayFieldType, LucideIcon> = {
  heading: HeadingIcon,
  paragraph: TextIcon,
  image: ImageIcon,
};

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
  autoReplyEnabled: false,
  autoReplySubject: "",
  autoReplyBody: "",
  notifyEmails: "",
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
  const hasEmailField = form.fields.some((f) => f.mapTo === "email");

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
          autoReplyEnabled: form.autoReplyEnabled,
          autoReplySubject: form.autoReplySubject,
          autoReplyBody: form.autoReplyBody,
          notifyEmails: form.notifyEmails,
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
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="mb-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <Card padding="none" className="mb-6">
        <CardHeader title="基本情報" />
        <div className="space-y-5 p-5">
          <Field label="タイトル">
            <Input
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              required
            />
          </Field>

          <Field label="説明">
            <Textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
            />
          </Field>

          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            <Field label="状態">
              <Select value={form.status} onChange={(e) => update("status", e.target.value)}>
                <option value="draft">下書き</option>
                <option value="published">公開</option>
                <option value="closed">受付終了</option>
              </Select>
            </Field>

            <Field label="登録先リスト（任意）">
              <Select
                value={form.targetListId ?? ""}
                onChange={(e) => update("targetListId", e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">なし</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="サンクスメッセージ">
            <Textarea
              value={form.thankYouMessage}
              onChange={(e) => update("thankYouMessage", e.target.value)}
              rows={2}
              placeholder="送信ありがとうございました。（未入力の場合はこの既定文が使われます）"
            />
          </Field>

          {/* 以下は基本情報カード内の小節。見出しを付けて、5 セクションが一枚に詰まって見えないようにする */}
          <div className="border-t border-line pt-5">
            <FieldsetTitle>メルマガ同意</FieldsetTitle>
            <Field inline label="メルマガ配信の同意を求める（同意した回答者のみ配信対象になります）">
              <Checkbox
                checked={form.requireOptIn}
                onChange={(e) => update("requireOptIn", e.target.checked)}
              />
            </Field>
          </div>

          <div className="space-y-4 border-t border-line pt-5">
            <FieldsetTitle>自動返信</FieldsetTitle>
            <Field inline label="自動返信メールを送る">
              <Checkbox
                checked={form.autoReplyEnabled}
                onChange={(e) => update("autoReplyEnabled", e.target.checked)}
              />
            </Field>

            {!hasEmailField && (
              <Alert tone="warning" compact>
                「メールアドレス」にマッピングされた項目がまだありません。自動返信を送るには、項目のいずれかで「連絡先へのマッピング」を「メールアドレス」に設定してください。
              </Alert>
            )}

            {form.autoReplyEnabled && (
              <div className="space-y-5 pl-6">
                <Field label="件名">
                  <Input
                    type="text"
                    value={form.autoReplySubject}
                    onChange={(e) => update("autoReplySubject", e.target.value)}
                    placeholder="お問い合わせありがとうございます"
                  />
                </Field>

                <Field
                  label="本文"
                  hint={
                    <>
                      差し込みタグ {"{{name}}"}（名前）・{"{{company}}"}（企業名）が使えます。改行はそのままメール本文に反映されます。
                    </>
                  }
                >
                  <Textarea
                    value={form.autoReplyBody}
                    onChange={(e) => update("autoReplyBody", e.target.value)}
                    rows={6}
                    placeholder={"{{name}} 様\n\nこの度はお問い合わせいただきありがとうございます。\n内容を確認の上、担当者よりご連絡いたします。"}
                  />
                </Field>
              </div>
            )}
          </div>

          <div className="border-t border-line pt-5">
            <FieldsetTitle>通知先</FieldsetTitle>
            <Field
              label="管理者への通知先メールアドレス"
              hint="カンマ区切りで複数設定できます。回答があるたびに通知メールが届きます。空欄の場合は通知しません。"
            >
              <Input
                type="text"
                value={form.notifyEmails}
                onChange={(e) => update("notifyEmails", e.target.value)}
                placeholder="例: admin@example.com, staff@example.com"
              />
            </Field>
          </div>

          {isEdit && (
            <div className="border-t border-line pt-5">
              <FieldsetTitle>公開URL</FieldsetTitle>
              <div className="flex items-center gap-2">
                <code className="block h-9 min-w-0 flex-1 truncate rounded-md border border-line bg-surface-muted px-3 font-mono text-sm leading-9 text-ink">
                  {publicUrl || "(保存後に発行されます)"}
                </code>
                {publicUrl && (
                  <>
                    <IconButton
                      label="コピー"
                      icon={copied ? <Check /> : <Copy />}
                      onClick={handleCopyUrl}
                    />
                    {copied && <span className="text-caption text-success-ink">コピーしました</span>}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card padding="none">
        <CardHeader
          title="項目"
          actions={
            <Button size="sm" icon={<Plus />} onClick={addField}>
              項目を追加
            </Button>
          }
        />
        <div className="space-y-4 p-5">
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
            <EmptyState size="sm" title="項目がありません。「+ 項目を追加」から追加してください。" />
          )}
        </div>
      </Card>

      {/* 保存行は画面下に固定し、最上部と同じエラーをバー直上にも出す */}
      <StickyActionBar
        start={
          isEdit && (
            <Button
              variant="dangerGhost"
              icon={<Trash2 />}
              onClick={handleDelete}
              disabled={deleting}
              loading={deleting}
            >
              {deleting ? "削除中..." : "フォームを削除"}
            </Button>
          )
        }
        error={
          error && (
            <Alert tone="danger" compact>
              {error}
            </Alert>
          )
        }
      >
        <Button onClick={() => router.push("/forms")}>キャンセル</Button>
        <Button type="submit" variant="primary" disabled={saving} loading={saving}>
          {saving ? "保存中..." : "保存"}
        </Button>
      </StickyActionBar>
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
  const isDisplay = isDisplayField(field);
  const showOptions = !isDisplay && HAS_OPTIONS.includes(field.type);
  const optionsText = (field.options || []).join("\n");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState("");
  const DisplayIcon = isDisplay ? DISPLAY_ICONS[field.type as DisplayFieldType] : null;

  async function handleImageUpload(file: File | null) {
    if (!file) return;
    setImageUploading(true);
    setImageError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/forms/image", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "アップロードに失敗しました");
      onChange({ content: data.url });
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setImageUploading(false);
    }
  }

  return (
    <div className="rounded-lg border border-line p-4">
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-0.5">
          <IconButton
            label="上へ"
            size="sm"
            icon={<ChevronUp />}
            onClick={() => onMove(-1)}
            disabled={index === 0}
          />
          <IconButton
            label="下へ"
            size="sm"
            icon={<ChevronDown />}
            onClick={() => onMove(1)}
            disabled={index === total - 1}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          {DisplayIcon && (
            // 表示専用ブロックだけ左肩に目印を出す（文言は種類 select の optgroup と同じ）
            <p className="flex items-center gap-1.5 text-caption font-medium text-ink-subtle">
              <DisplayIcon className="size-4" aria-hidden="true" />
              表示のみ（回答なし）
            </p>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Field label="種類">
              <Select
                size="sm"
                value={field.type}
                onChange={(e) => {
                  const type = e.target.value as FieldType;
                  // 表示専用に切り替えたら、入力項目にしか意味のない設定は落とす。
                  // 残しておくと画面には出ないのに JSON に必須フラグなどが残り、
                  // あとで入力項目に戻したときに意図しない状態で復活する。
                  onChange(
                    isDisplayField({ type })
                      ? { type, required: false, mapTo: undefined, options: undefined, hint: undefined }
                      : { type, content: undefined }
                  );
                }}
              >
                <optgroup label="入力項目">
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="表示のみ（回答なし）">
                  {DISPLAY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </Field>

            <Field
              label={
                field.type === "heading"
                  ? "見出しの文言"
                  : field.type === "paragraph"
                    ? "見出し（任意）"
                    : field.type === "image"
                      ? "代替テキスト（任意）"
                      : "ラベル"
              }
            >
              <Input
                size="sm"
                type="text"
                value={field.label}
                onChange={(e) => onChange({ label: e.target.value })}
                required={!isDisplay || field.type === "heading"}
              />
            </Field>
          </div>

          {field.type === "paragraph" && (
            <Field label="本文">
              <Textarea
                value={field.content || ""}
                onChange={(e) => onChange({ content: e.target.value })}
                rows={4}
                placeholder="フォーム上に表示する説明文を入力してください（改行はそのまま反映されます）"
              />
            </Field>
          )}

          {field.type === "image" && (
            // FileInput 自体が <label> なので、外側は htmlFor で関連付ける（label の入れ子を避ける）
            <Field
              label="画像"
              htmlFor={`${field.id}-image`}
              hint="PNG / JPEG / GIF / WebP / SVG・5MBまで"
            >
              {field.content && (
                <img
                  src={formImageSrc(field.content)}
                  alt={field.label || ""}
                  className="mb-2 max-h-40 rounded-md border border-line"
                />
              )}
              <FileInput
                id={`${field.id}-image`}
                accept="image/*"
                onChange={(e) => handleImageUpload(e.target.files?.[0] || null)}
              />
              {imageUploading && (
                <p className="mt-1.5 flex items-center gap-1.5 text-caption text-ink-subtle">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  アップロード中...
                </p>
              )}
              {/* 既存の表示順（アップロード中 → エラー → 注記）を保つため、Field の error prop ではなく
                  ここで描画する（Field の Notes は 注記 → エラー の順になるため）。見た目は Field の error と同じ */}
              {imageError && (
                <p className="mt-1.5 text-caption text-danger" role="alert">
                  {imageError}
                </p>
              )}
            </Field>
          )}

          {!isDisplay && (
            <Field label="補足文（任意）">
              <Input
                size="sm"
                type="text"
                value={field.hint || ""}
                onChange={(e) => onChange({ hint: e.target.value })}
                placeholder="例: 半角英数字でご記入ください"
              />
            </Field>
          )}

          {showOptions && (
            <Field label="選択肢（改行またはカンマ区切り）">
              <Textarea
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
              />
            </Field>
          )}

          {!isDisplay && (
            <div className="grid grid-cols-2 items-end gap-x-4 gap-y-4">
              <Field label="連絡先へのマッピング">
                <Select
                  size="sm"
                  value={field.mapTo || ""}
                  onChange={(e) => onChange({ mapTo: (e.target.value || undefined) as FormField["mapTo"] })}
                >
                  {MAP_TO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </Field>

              {/* 隣の h-8 の select と高さを合わせる */}
              <div className="pb-1.5">
                <Field inline label="必須項目にする">
                  <Checkbox
                    checked={field.required}
                    onChange={(e) => onChange({ required: e.target.checked })}
                  />
                </Field>
              </div>
            </div>
          )}
        </div>

        <IconButton label="削除" tone="danger" icon={<Trash2 />} onClick={onRemove} className="shrink-0" />
      </div>
    </div>
  );
}
