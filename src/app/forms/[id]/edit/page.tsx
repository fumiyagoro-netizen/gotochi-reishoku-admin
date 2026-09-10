"use client";

import { useState, useEffect, use } from "react";
import { FormBuilder, type FormData } from "@/components/form-builder";
import { useRole } from "@/lib/role-context";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { NoPermission } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { CardSkeleton } from "@/components/ui/skeleton";

export default function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { permissions } = useRole();
  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/forms/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setForm({
            id: data.form.id,
            slug: data.form.slug,
            title: data.form.title,
            description: data.form.description,
            status: data.form.status,
            fields: data.form.fields || [],
            targetListId: data.form.targetListId,
            requireOptIn: data.form.requireOptIn,
            thankYouMessage: data.form.thankYouMessage,
            autoReplyEnabled: data.form.autoReplyEnabled,
            autoReplySubject: data.form.autoReplySubject,
            autoReplyBody: data.form.autoReplyBody,
            notifyEmails: data.form.notifyEmails,
          });
        } else {
          setError(data.message);
        }
        setLoading(false);
      });
  }, [id]);

  // Part of the forms feature — gated the same way as /forms. The API
  // enforces this too; this only keeps the page from rendering the form
  // builder for roles that must not reach it.
  if (!permissions.canManageForms) {
    return (
      <PageContainer width="form">
        <NoPermission message="閲覧権限がありません" />
      </PageContainer>
    );
  }

  return (
    <PageContainer width="form">
      <PageHeader title="フォーム編集" backHref="/forms" backLabel="フォーム一覧" />

      {loading ? (
        // 基本情報カード＋項目カードの形で待つ（文言「読み込み中...」は sr-only で残る）
        <div className="space-y-6">
          <CardSkeleton lines={6} />
          <CardSkeleton lines={3} />
        </div>
      ) : error ? (
        <Alert tone="danger">{error}</Alert>
      ) : form ? (
        <FormBuilder initial={form} />
      ) : null}
    </PageContainer>
  );
}
