"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/field-controls";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineConfirm } from "@/components/ui/inline-confirm";
import { ArrowDown, ArrowUp, Pencil, Plus } from "@/components/ui/icons";
import { ImageField, ImagesField } from "./site-image-field";
import type { SiteCollectionKind, SiteUploadKind } from "@/lib/site-collections-shared";

/**
 * サイト管理の一覧画面（お知らせ・審査員・受賞者の声・パートナー）の共通部品。
 * 一覧表＋「新規作成」＋編集モーダル（削除つき）＋並べ替え。保存は /api/site/[collection]。
 * 画面ごとの違い（列・入力欄）は各 *-editor.tsx が columns / fields で渡す。
 */

type Common = { key: string; label: string; hint?: string; full?: boolean };
export type FieldDef =
  | (Common & { type: "text" | "url"; required?: boolean; maxLength?: number; placeholder?: string })
  | (Common & { type: "textarea"; required?: boolean; rows?: number; placeholder?: string })
  | (Common & { type: "select"; required?: boolean; options: { value: string; label: string }[] })
  | (Common & { type: "date" })
  | (Common & { type: "checkbox" })
  | (Common & { type: "image"; uploadKind: SiteUploadKind; contain?: boolean })
  | (Common & { type: "images"; uploadKind: SiteUploadKind; max: number });

export type Column<T> = { header: string; render: (item: T) => ReactNode; width?: string; nowrap?: boolean };

type Values = Record<string, unknown>;

async function send(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.message || "保存に失敗しました");
  return data;
}

export function CollectionEditor<T extends { id: number }>({
  kind,
  itemLabel,
  items,
  columns,
  fields,
  defaults = {},
  sortable = false,
  sameGroup,
  emptyTitle,
  emptyDescription,
}: {
  kind: SiteCollectionKind;
  /** 「お知らせ」「審査員」など。ボタンやモーダルの見出しに使う */
  itemLabel: string;
  items: T[];
  columns: Column<T>[];
  fields: FieldDef[];
  /** 新規作成時の初期値（年度など、フォームに出さない値もここで渡す） */
  defaults?: Values;
  sortable?: boolean;
  /** 並べ替えの単位（パートナーは同じ種別の中だけで並べる） */
  sameGroup?: (a: T, b: T) => boolean;
  emptyTitle: string;
  emptyDescription?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: number | null; values: Values } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moving, setMoving] = useState(false);

  function open(item: T | null) {
    setError("");
    setConfirmDelete(false);
    if (!item) {
      setEditing({ id: null, values: { ...defaults } });
      return;
    }
    const values: Values = {};
    for (const f of fields) values[f.key] = (item as unknown as Values)[f.key];
    setEditing({ id: item.id, values });
  }

  function set(key: string, value: unknown) {
    setEditing((e) => (e ? { ...e, values: { ...e.values, [key]: value } } : e));
  }

  async function save() {
    if (!editing) return;
    const missing = fields.find((f) => "required" in f && f.required && !String(editing.values[f.key] ?? "").trim());
    if (missing) {
      setError(`「${missing.label}」を入れてください`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing.id) await send("PUT", `/api/site/${kind}/${editing.id}`, editing.values);
      else await send("POST", `/api/site/${kind}`, { ...defaults, ...editing.values });
      setEditing(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing?.id) return;
    setSaving(true);
    setError("");
    try {
      await send("DELETE", `/api/site/${kind}/${editing.id}`);
      setEditing(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  const groupOf = (item: T) => (sameGroup ? items.filter((o) => sameGroup(o, item)) : items);

  async function move(item: T, dir: -1 | 1) {
    const group = groupOf(item);
    const i = group.findIndex((o) => o.id === item.id);
    const j = i + dir;
    if (j < 0 || j >= group.length) return;
    const ids = group.map((o) => o.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setMoving(true);
    try {
      await send("POST", `/api/site/${kind}/reorder`, { ids });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "並べ替えに失敗しました");
    } finally {
      setMoving(false);
    }
  }

  const colCount = columns.length + 1 + (sortable ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" icon={<Plus />} onClick={() => open(null)}>
          {itemLabel}を追加
        </Button>
      </div>

      <Table>
        <thead>
          <tr>
            {sortable && <Th width="w-20">並び順</Th>}
            {columns.map((c) => (
              <Th key={c.header} width={c.width}>
                {c.header}
              </Th>
            ))}
            <Th srLabel="操作" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const group = groupOf(item);
            const gi = group.findIndex((o) => o.id === item.id);
            return (
              <Tr key={item.id}>
                {sortable && (
                  <Td nowrap>
                    <span className="inline-flex gap-1">
                      <Button variant="ghost" size="sm" icon={<ArrowUp />} disabled={moving || gi === 0} onClick={() => move(item, -1)} aria-label="上へ" />
                      <Button variant="ghost" size="sm" icon={<ArrowDown />} disabled={moving || gi === group.length - 1} onClick={() => move(item, 1)} aria-label="下へ" />
                    </span>
                  </Td>
                )}
                {columns.map((c) => (
                  <Td key={c.header} nowrap={c.nowrap}>
                    {c.render(item)}
                  </Td>
                ))}
                <Td nowrap className="text-right">
                  <Button variant="link" size="sm" icon={<Pencil />} onClick={() => open(item)}>
                    編集
                  </Button>
                </Td>
              </Tr>
            );
          })}
          {items.length === 0 && <EmptyState colSpan={colCount} title={emptyTitle} description={emptyDescription} />}
        </tbody>
      </Table>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? `${itemLabel}を編集` : `${itemLabel}を追加`}
        size="lg"
        footerStart={
          editing?.id ? (
            confirmDelete ? (
              <InlineConfirm
                message="削除すると元に戻せません。"
                confirmLabel="削除する"
                loading={saving}
                onConfirm={remove}
                onCancel={() => setConfirmDelete(false)}
              />
            ) : (
              <Button variant="dangerGhost" size="sm" onClick={() => setConfirmDelete(true)}>
                削除
              </Button>
            )
          ) : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              キャンセル
            </Button>
            <Button variant="primary" loading={saving} disabled={saving} onClick={save}>
              保存
            </Button>
          </>
        }
      >
        {editing && (
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className={f.full || f.type === "textarea" || f.type === "images" ? "md:col-span-2" : undefined}>
                <FieldControl field={f} value={editing.values[f.key]} onChange={(v) => set(f.key, v)} />
              </div>
            ))}
            {error && (
              <div className="md:col-span-2">
                <Alert tone="danger" compact>
                  {error}
                </Alert>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function FieldControl({ field: f, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const id = `site-field-${f.key}`;
  const text = value == null ? "" : String(value);
  const labelHint = "required" in f && f.required ? "必須" : undefined;

  if (f.type === "checkbox") {
    return (
      <Field inline label={f.label} hint={f.hint} htmlFor={id}>
        <Checkbox id={id} checked={value === true} onChange={(e) => onChange(e.target.checked)} />
      </Field>
    );
  }

  let control: ReactNode;
  switch (f.type) {
    case "text":
    case "url":
      control = (
        <Input id={id} type={f.type === "url" ? "url" : "text"} value={text} maxLength={f.maxLength} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
      );
      break;
    case "textarea":
      control = <Textarea id={id} rows={f.rows ?? 4} value={text} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "select":
      control = (
        <Select id={id} value={text} onChange={(e) => onChange(e.target.value)}>
          <option value="">選んでください</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      );
      break;
    case "date":
      control = <Input id={id} type="date" value={text} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "image":
      control = <ImageField kind={f.uploadKind} value={text} contain={f.contain} onChange={onChange} />;
      break;
    case "images":
      control = (
        <ImagesField kind={f.uploadKind} max={f.max} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />
      );
      break;
  }

  return (
    <Field label={f.label} labelHint={labelHint} hint={f.hint} htmlFor={id}>
      {control}
    </Field>
  );
}
