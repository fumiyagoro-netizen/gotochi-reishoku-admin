"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRole } from "@/lib/role-context";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { NoPermission } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Badge, type BadgeTone } from "@/components/ui/badge";
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

const STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  published: "公開",
  closed: "受付終了",
};

// 未知の状態は neutral ＋ 生文字列（旧 STATUS_COLORS の「無ければ空」と同じ扱い）
const STATUS_TONES: Record<string, BadgeTone> = {
  draft: "neutral",
  published: "success",
  closed: "warning",
};

// 表内の文字リンク型ボタン（「回答を見る」「編集」）。青はリンク専用色。
// 他の一覧（contacts / lists）と同じ形にして、行高 40px を保つ
const LINK_BUTTON_CLASS =
  "rounded-sm text-sm text-accent whitespace-nowrap hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
// 表内の「削除」。危険色の文字ボタン
const DANGER_BUTTON_CLASS =
  "rounded-sm text-sm text-danger whitespace-nowrap hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 disabled:opacity-50 disabled:cursor-not-allowed";

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
                  {/* 行高 40px を保つため、size-7 のアイコンボタン分だけ上下余白を打ち消す */}
                  <div className="-my-1 flex items-center gap-1.5">
                    <code className="font-mono text-caption">/f/{form.slug}</code>
                    <IconButton
                      label="コピー"
                      size="sm"
                      icon={copiedId === form.id ? <Check /> : <Copy />}
                      onClick={() => handleCopy(form)}
                    />
                    {copiedId === form.id && (
                      <span className="text-caption text-success-ink">コピーしました</span>
                    )}
                  </div>
                </Td>
                <Td>
                  <Badge tone={STATUS_TONES[form.status] ?? "neutral"}>
                    {STATUS_LABELS[form.status] || form.status}
                  </Badge>
                </Td>
                <Td numeric>
                  <Link href={`/forms/${form.id}/submissions`} className={LINK_BUTTON_CLASS}>
                    {form._count.submissions}件
                  </Link>
                </Td>
                <Td>
                  <div className="flex items-center gap-3">
                    <Link href={`/forms/${form.id}/submissions`} className={LINK_BUTTON_CLASS}>
                      回答を見る
                    </Link>
                    {permissions.canEdit && (
                      <Link href={`/forms/${form.id}/edit`} className={LINK_BUTTON_CLASS}>
                        編集
                      </Link>
                    )}
                    {permissions.canDelete && (
                      <button type="button" onClick={() => handleDelete(form)} className={DANGER_BUTTON_CLASS}>
                        削除
                      </button>
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
