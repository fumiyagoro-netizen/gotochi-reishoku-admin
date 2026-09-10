"use client";

import { useState, useEffect, useCallback } from "react";
import { useRole } from "@/lib/role-context";
import { formatYen } from "@/lib/invoice-shared";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { NoPermission } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/field";
import { Input, Checkbox } from "@/components/ui/field-controls";
import { InlineConfirm } from "@/components/ui/inline-confirm";
import { Plus, ChevronUp, ChevronDown, Receipt } from "@/components/ui/icons";

interface InvoiceItemRow {
  id: number;
  name: string;
  unitPrice: number;
  sortOrder: number;
  isActive: boolean;
}

export default function InvoiceItemsPage() {
  const { permissions } = useRole();
  const [items, setItems] = useState<InvoiceItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InvoiceItemRow | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/invoice-items");
      const data = await res.json();
      if (data.success) setItems(data.items);
      else setErrorMsg(data.message || "取得に失敗しました");
    } catch (e) {
      setErrorMsg("通信エラー: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    // sortOrder を入れ替える。form-builder.tsx の moveField と違いこちらは
    // 保存済みデータなので、画面上の並び替えと同時に2件 PATCH してサーバー側
    // の並び順も揃える。
    await Promise.all([
      fetch(`/api/invoice-items/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: b.sortOrder }),
      }),
      fetch(`/api/invoice-items/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: a.sortOrder }),
      }),
    ]);
    fetchItems();
  }

  if (!permissions.canManageInvoices) {
    return (
      <PageContainer>
        <NoPermission message="閲覧権限がありません" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="請求項目マスタ"
        count={items.length}
        backHref="/invoices"
        backLabel="請求書一覧"
        actions={
          <Button
            variant="primary"
            icon={<Plus />}
            onClick={() => { setEditingItem(null); setShowForm(true); }}
          >
            新規追加
          </Button>
        }
      />

      {errorMsg && (
        <div className="mb-4">
          <Alert tone="danger">{errorMsg}</Alert>
        </div>
      )}

      {loading ? (
        <TableSkeleton cols={4} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>品名</Th>
              <Th align="right">単価（税別）</Th>
              <Th>状態</Th>
              <Th width="w-40">操作</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              // 無効行は opacity ではなく文字色を落とす（バッジと「編集」は読めるまま）
              <Tr key={item.id} muted={!item.isActive}>
                <Td primary>{item.name}</Td>
                <Td numeric>{formatYen(item.unitPrice)}</Td>
                <Td>
                  {item.isActive ? (
                    <Badge tone="success">有効</Badge>
                  ) : (
                    <Badge tone="outline">無効</Badge>
                  )}
                </Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <IconButton
                      size="sm"
                      label="上へ"
                      icon={<ChevronUp />}
                      onClick={() => moveItem(i, -1)}
                      disabled={i === 0}
                    />
                    <IconButton
                      size="sm"
                      label="下へ"
                      icon={<ChevronDown />}
                      onClick={() => moveItem(i, 1)}
                      disabled={i === items.length - 1}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setEditingItem(item); setShowForm(true); }}
                    >
                      編集
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
            {items.length === 0 && (
              <EmptyState
                icon={Receipt}
                title="請求項目マスタがありません"
                description="「新規追加」で登録すると、請求書作成時の明細の選択肢に表示されます"
                colSpan={4}
              />
            )}
          </tbody>
        </Table>
      )}

      {showForm && (
        <InvoiceItemFormModal
          item={editingItem}
          onClose={() => { setShowForm(false); setEditingItem(null); }}
          onSaved={fetchItems}
        />
      )}
    </PageContainer>
  );
}

function InvoiceItemFormModal({
  item,
  onClose,
  onSaved,
}: {
  item: InvoiceItemRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;
  const [name, setName] = useState(item?.name || "");
  // Held as the raw string so an in-progress value the parser can't read yet
  // — "" while clearing the field, or a lone "-" before the digits — stays on
  // screen. Coercing to a number on every keystroke snapped those back to 0,
  // which left a 0 that could not be deleted and made negative amounts
  // impossible to type. Parsed once on submit instead.
  const [unitPrice, setUnitPrice] = useState(String(item?.unitPrice ?? 0));
  const [isActive, setIsActive] = useState(item?.isActive ?? true);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(isEdit ? `/api/invoice-items/${item!.id}` : "/api/invoice-items", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, unitPrice: parseInt(unitPrice, 10) || 0, isActive }),
      });
      const data = await res.json();
      if (data.success) {
        onSaved();
        onClose();
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
    if (!item) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/invoice-items/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        onSaved();
        onClose();
      } else {
        setError(data.message);
      }
    } catch {
      setError("削除に失敗しました");
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    // 既存どおり背景クリックで閉じる（＝Esc でも閉じる）。パネル自体を form にして
    // フッタの type="submit" と required 検証をそのまま効かせる
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "請求項目編集" : "請求項目追加"}
      closeOnBackdrop
      as="form"
      onSubmit={handleSubmit}
      footerStart={
        isEdit && (
          confirmingDelete ? (
            <InlineConfirm
              message="削除しますか？"
              confirmLabel="削除する"
              loadingLabel="削除中..."
              loading={deleting}
              onConfirm={handleDelete}
              onCancel={() => setConfirmingDelete(false)}
            />
          ) : (
            <Button variant="dangerGhost" onClick={() => setConfirmingDelete(true)}>
              削除
            </Button>
          )
        )
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button variant="primary" type="submit" disabled={saving} loading={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </>
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}

      <Field label="品名">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </Field>

      <Field label="単価（税別）" labelHint="マイナス可（割引など）">
        <Input
          type="number"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          required
        />
      </Field>

      <Field inline label="有効（請求書作成時の選択肢に表示する）">
        <Checkbox
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
      </Field>
    </Modal>
  );
}
