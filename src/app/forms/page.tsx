"use client";

import { useState, useEffect, useCallback } from "react";
import { useRole } from "@/lib/role-context";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { NoPermission } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { FormStatusBadge } from "@/components/ui/badge";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Check, Copy, FileText, Plus } from "@/components/ui/icons";

interface FormRow {
  id: number;
  slug: string;
  title: string;
  status: string;
  createdAt: string;
  _count: { submissions: number };
}

export default function FormsPage() {
  const { permissions } = useRole();
  const [forms, setForms] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchForms = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/forms");
    const data = await res.json();
    if (data.success) setForms(data.forms);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  // Forms (フォーム) is gated by canManageForms, not canEdit: editor keeps
  // canEdit=true for entries but must not reach the forms feature at all.
  // The API enforces this too; this only keeps the page from rendering an
  // empty shell.
  if (!permissions.canManageForms) {
    return (
      <PageContainer>
        <NoPermission message="閲覧権限がありません" />
      </PageContainer>
    );
  }

  async function handleDelete(form: FormRow) {
    if (!confirm(`「${form.title}」を削除しますか？回答データもすべて削除されます。`)) return;
    const res = await fetch(`/api/forms/${form.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      fetchForms();
    } else {
      alert(data.message);
    }
  }

  async function handleCopy(form: FormRow) {
    const url = `${window.location.origin}/f/${form.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(form.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="フォーム"
        count={forms.length}
        actions={
          permissions.canEdit && (
            <ButtonLink href="/forms/new" variant="primary" icon={<Plus />}>
              フォーム作成
            </ButtonLink>
          )
        }
      />

      {loading ? (
        <TableSkeleton cols={5} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>タイトル</Th>
              <Th>公開URL</Th>
              <Th>状態</Th>
              <Th align="right">回答数</Th>
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody>
            {forms.map((form) => (
              <Tr key={form.id}>
                <Td primary>{form.title}</Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    <code className="font-mono text-caption">/f/{form.slug}</code>
                    <IconButton
                      label="コピー"
                      size="xs"
                      icon={copiedId === form.id ? <Check /> : <Copy />}
                      onClick={() => handleCopy(form)}
                    />
                    {copiedId === form.id && (
                      <span className="text-caption text-success-ink">コピーしました</span>
                    )}
                  </div>
                </Td>
                <Td>
                  <FormStatusBadge status={form.status} />
                </Td>
                <Td numeric>
                  <ButtonLink href={`/forms/${form.id}/submissions`} variant="link">
                    {form._count.submissions}件
                  </ButtonLink>
                </Td>
                <Td>
                  <div className="flex items-center gap-3">
                    <ButtonLink href={`/forms/${form.id}/submissions`} variant="link">
                      回答を見る
                    </ButtonLink>
                    {permissions.canEdit && (
                      <ButtonLink href={`/forms/${form.id}/edit`} variant="link">
                        編集
                      </ButtonLink>
                    )}
                    {permissions.canDelete && (
                      <Button variant="linkDanger" onClick={() => handleDelete(form)}>
                        削除
                      </Button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
            {forms.length === 0 && (
              <EmptyState
                colSpan={5}
                icon={FileText}
                title="フォームがありません"
                description={
                  permissions.canEdit
                    ? "「フォーム作成」から作成すると、ここに表示されます"
                    : undefined
                }
              />
            )}
          </tbody>
        </Table>
      )}
    </PageContainer>
  );
}
