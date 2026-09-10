"use client";

import { useState, useEffect, use } from "react";
import { isDisplayField } from "@/lib/form-shared";
import type { FormField, FormAnswers } from "@/lib/form-shared";
import { useRole } from "@/lib/role-context";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { NoPermission } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Download, Loader2 } from "@/components/ui/icons";

// 表内の「削除」。他の一覧と同じ文字ボタン型にして行高を増やさない（危険色）
const DANGER_BUTTON_CLASS =
  "inline-flex items-center gap-1 rounded-sm text-sm text-danger whitespace-nowrap hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 disabled:opacity-50 disabled:cursor-not-allowed";

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
  const { permissions } = useRole();
  const [form, setForm] = useState<FormInfo | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // 見出し・説明文・画像はフォーム上の飾りで回答を持たないため、列にしない。
  // Excel出力側 (api/forms/[id]/submissions/export) も同じ条件で外している。
  const answerFields = (form?.fields || []).filter((f) => !isDisplayField(f));

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

  async function handleDelete(submissionId: number) {
    if (
      !window.confirm(
        "この回答を削除します。添付ファイルも一緒に削除され、元に戻せません。よろしいですか？"
      )
    ) {
      return;
    }
    setDeletingId(submissionId);
    try {
      const res = await fetch(`/api/forms/${id}/submissions/${submissionId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
      } else {
        setError(data.message || "削除に失敗しました");
      }
    } catch {
      setError("削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  }

  function renderValue(field: FormField, value: string | string[] | undefined) {
    if (value === undefined || value === null || value === "") return "-";

    if (field.type === "file") {
      const urls = Array.isArray(value) ? value : [value];
      return (
        <div className="flex flex-col gap-1">
          {urls.filter(isFileUrl).map((url, i) => (
            <a
              key={i}
              /* blob の URL は private なので直リンクでは開けない。
                 認証を通す /api/forms/attachment 経由にする。 */
              href={`/api/forms/attachment?url=${encodeURIComponent(url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              添付ファイル{urls.length > 1 ? ` ${i + 1}` : ""}
            </a>
          ))}
        </div>
      );
    }

    return Array.isArray(value) ? value.join(", ") : value;
  }

  // Part of the forms feature — gated the same way as /forms. The API
  // enforces this too; this only keeps the page from rendering an empty
  // shell (or a "回答がありません" message) for roles that must not reach it.
  if (!permissions.canManageForms) {
    return (
      <PageContainer>
        <NoPermission message="閲覧権限がありません" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={form ? `${form.title} の回答` : "回答一覧"}
        count={submissions.length}
        backHref="/forms"
        backLabel="フォーム一覧"
        actions={
          form && (
            // Excel は API のネイティブ遷移なので <a href>（external）のまま
            <ButtonLink
              href={`/api/forms/${id}/submissions/export`}
              external
              variant="primary"
              icon={<Download />}
            >
              Excelでダウンロード
            </ButtonLink>
          )
        }
      />

      {loading ? (
        <TableSkeleton cols={4} />
      ) : error ? (
        <Alert tone="danger">{error}</Alert>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>受信日時</Th>
              <Th>連絡先</Th>
              {answerFields.map((field) => (
                <Th key={field.id}>{field.label}</Th>
              ))}
              {permissions.canDelete && <Th width="w-16" srLabel="削除" />}
            </tr>
          </thead>
          <tbody>
            {submissions.map((submission) => (
              <Tr key={submission.id}>
                <Td nowrap>
                  {/* Pinned to Asia/Tokyo so it matches the Excel export and
                      doesn't shift between server render and hydration. */}
                  {new Date(submission.createdAt).toLocaleString("ja-JP", {
                    timeZone: "Asia/Tokyo",
                  })}
                </Td>
                <Td nowrap>
                  {submission.contact ? (
                    <div>
                      <div className="text-ink">{submission.contact.email}</div>
                      {submission.contact.name && (
                        <div className="text-caption text-ink-subtle">{submission.contact.name}</div>
                      )}
                    </div>
                  ) : (
                    "-"
                  )}
                </Td>
                {answerFields.map((field) => (
                  <Td key={field.id} className="max-w-xs">
                    {renderValue(field, submission.answers[field.id])}
                  </Td>
                ))}
                {permissions.canDelete && (
                  <Td nowrap className="text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(submission.id)}
                      disabled={deletingId === submission.id}
                      aria-busy={deletingId === submission.id || undefined}
                      className={DANGER_BUTTON_CLASS}
                    >
                      {deletingId === submission.id && (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      )}
                      {deletingId === submission.id ? "削除中..." : "削除"}
                    </button>
                  </Td>
                )}
              </Tr>
            ))}
            {submissions.length === 0 && (
              <EmptyState
                colSpan={2 + answerFields.length + (permissions.canDelete ? 1 : 0)}
                title="回答がありません"
                description="公開URLから回答が送信されると、ここに表示されます"
              />
            )}
          </tbody>
        </Table>
      )}
    </PageContainer>
  );
}
