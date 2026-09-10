"use client";

import { FormBuilder } from "@/components/form-builder";
import { useRole } from "@/lib/role-context";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { NoPermission } from "@/components/ui/card";

export default function NewFormPage() {
  const { permissions } = useRole();

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
      <PageHeader title="フォーム作成" backHref="/forms" backLabel="フォーム一覧" />
      <FormBuilder />
    </PageContainer>
  );
}
