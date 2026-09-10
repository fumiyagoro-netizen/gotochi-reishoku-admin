"use client";

import { useState, useEffect, useCallback } from "react";
import { useRole } from "@/lib/role-context";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { NoPermission } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/ui/role-badge";
import { Alert } from "@/components/ui/alert";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/field";
import { Input, Select, Checkbox } from "@/components/ui/field-controls";
import { Plus, Users } from "@/components/ui/icons";

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const { role } = useRole();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    if (data.success) setUsers(data.users);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (role !== "admin") {
    return (
      <PageContainer>
        <NoPermission message="ユーザー管理の権限がありません" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="ユーザー管理"
        count={users.length}
        countUnit="名"
        actions={
          <Button
            variant="primary"
            icon={<Plus />}
            onClick={() => { setEditingUser(null); setShowForm(true); }}
          >
            ユーザー追加
          </Button>
        }
      />

      {loading ? (
        <TableSkeleton cols={5} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>名前</Th>
              <Th>メールアドレス</Th>
              <Th>権限</Th>
              <Th>状態</Th>
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <Tr key={user.id}>
                <Td primary>{user.name}</Td>
                <Td>{user.email}</Td>
                <Td>
                  {/* 役割→色は role-badge.tsx に一元化（代表者は紫、未知値は viewer 色＋生文字列） */}
                  <RoleBadge role={user.role} />
                </Td>
                <Td>
                  {user.isActive ? (
                    <Badge tone="success">有効</Badge>
                  ) : (
                    <Badge tone="outline">無効</Badge>
                  )}
                </Td>
                <Td>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setEditingUser(user); setShowForm(true); }}
                  >
                    編集
                  </Button>
                </Td>
              </Tr>
            ))}
            {users.length === 0 && (
              <EmptyState
                icon={Users}
                title="ユーザーが登録されていません"
                description="「ユーザー追加」から登録すると、ここに表示されます"
                colSpan={5}
              />
            )}
          </tbody>
        </Table>
      )}

      {showForm && (
        <UserFormModal
          user={editingUser}
          onClose={() => setShowForm(false)}
          onSaved={fetchUsers}
        />
      )}
    </PageContainer>
  );
}

function UserFormModal({
  user,
  onClose,
  onSaved,
}: {
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!user;
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [userRole, setUserRole] = useState<string>(user?.role || "viewer");
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (isEdit) {
        const body: Record<string, unknown> = { name, role: userRole, isActive };
        if (password) body.password = password;

        const res = await fetch(`/api/users/${user!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.success) { setError(data.message); return; }
      } else {
        if (!password) { setError("パスワードを入力してください"); return; }
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name, role: userRole }),
        });
        const data = await res.json();
        if (!data.success) { setError(data.message); return; }
      }

      onSaved();
      onClose();
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`${user!.name} を削除しますか？`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${user!.id}`, { method: "DELETE" });
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
    // 背景クリック・Esc では閉じない（既存どおり）。パネル自体を form にして
    // フッタの type="submit" と required / minLength 検証をそのまま効かせる
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "ユーザー編集" : "ユーザー追加"}
      as="form"
      onSubmit={handleSubmit}
      footerStart={
        isEdit && (
          // 削除は既存どおり confirm() で確認する（InlineConfirm に置換しない）
          <Button
            variant="dangerGhost"
            onClick={handleDelete}
            disabled={deleting}
            loading={deleting}
          >
            {deleting ? "削除中..." : "ユーザーを削除"}
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

      <Field label="名前">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </Field>

      <Field label="メールアドレス">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isEdit}
        />
      </Field>

      <Field label={<>パスワード{isEdit && "（変更する場合のみ）"}</>}>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required={!isEdit}
          minLength={6}
          placeholder={isEdit ? "変更しない場合は空欄" : "6文字以上"}
        />
      </Field>

      <Field label="権限ロール">
        <Select
          value={userRole}
          onChange={(e) => setUserRole(e.target.value)}
        >
          <option value="admin">管理者 — すべての操作が可能</option>
          <option value="representative">代表者 — 設定・ユーザー管理・操作ログ・年度管理・削除以外</option>
          <option value="editor">編集者 — 削除・受賞設定以外</option>
          <option value="viewer">閲覧者 — 閲覧のみ</option>
          <option value="judge">審査員 — 閲覧のみ＋審査コメントの投稿</option>
        </Select>
      </Field>

      {isEdit && (
        <Field inline label="有効">
          <Checkbox
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
        </Field>
      )}
    </Modal>
  );
}
