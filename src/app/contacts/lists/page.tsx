"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRole } from "@/lib/role-context";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { NoPermission } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/field-controls";
import { ListPlus, Plus, Trash2 } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, Td, Th, Tr } from "@/components/ui/table";

interface ContactListRow {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  _count: { memberships: number };
}

export default function ContactListsPage() {
  const { permissions } = useRole();
  const [lists, setLists] = useState<ContactListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingList, setEditingList] = useState<ContactListRow | null>(null);

  const fetchLists = useCallback(async () => {
    const res = await fetch("/api/contacts/lists");
    const data = await res.json();
    if (data.success) setLists(data.lists);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  // Part of the contacts feature — gated the same way as /contacts.
  if (!permissions.canManageContacts) {
    return (
      <PageContainer>
        <NoPermission message="閲覧権限がありません" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="リスト管理"
        count={lists.length}
        backHref="/contacts"
        backLabel="連絡先一覧"
        actions={
          permissions.canEdit && (
            <Button
              variant="primary"
              icon={<Plus />}
              onClick={() => { setEditingList(null); setShowForm(true); }}
            >
              リスト追加
            </Button>
          )
        }
      />

      {loading ? (
        <TableSkeleton cols={4} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>リスト名</Th>
              <Th>説明</Th>
              <Th align="right">件数</Th>
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody>
            {lists.map((list) => (
              <Tr key={list.id}>
                <Td primary>
                  <Link
                    href={`/contacts?listId=${list.id}`}
                    className="rounded-sm text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    {list.name}
                  </Link>
                </Td>
                <Td>{list.description}</Td>
                <Td numeric>{list._count.memberships}件</Td>
                <Td>
                  {permissions.canEdit && (
                    <Button
                      variant="link"
                      onClick={() => { setEditingList(list); setShowForm(true); }}
                    >
                      編集
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
            {lists.length === 0 && (
              <EmptyState
                colSpan={4}
                icon={ListPlus}
                title="リストがありません"
                description={
                  permissions.canEdit ? "「リスト追加」から作成すると、ここに表示されます" : undefined
                }
              />
            )}
          </tbody>
        </Table>
      )}

      {showForm && (
        <ListFormModal
          list={editingList}
          onClose={() => setShowForm(false)}
          onSaved={fetchLists}
        />
      )}
    </PageContainer>
  );
}

function ListFormModal({
  list,
  onClose,
  onSaved,
}: {
  list: ContactListRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { permissions } = useRole();
  const isEdit = !!list;
  const [name, setName] = useState(list?.name || "");
  const [description, setDescription] = useState(list?.description || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(
        isEdit ? `/api/contacts/lists/${list!.id}` : "/api/contacts/lists",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        }
      );
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
    if (!confirm(`「${list!.name}」を削除しますか？`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/contacts/lists/${list!.id}`, { method: "DELETE" });
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
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "リスト編集" : "リスト追加"}
      size="md"
      as="form"
      onSubmit={handleSubmit}
      // 削除は native confirm() のまま（置換対象外）
      footerStart={
        isEdit && permissions.canDelete && (
          <Button
            variant="dangerGhost"
            icon={<Trash2 />}
            onClick={handleDelete}
            disabled={deleting}
            loading={deleting}
          >
            {deleting ? "削除中..." : "リストを削除"}
          </Button>
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

      <Field label="リスト名">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </Field>
      <Field label="説明">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </Field>
    </Modal>
  );
}
