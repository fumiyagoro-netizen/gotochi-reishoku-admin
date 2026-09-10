"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRole } from "@/lib/role-context";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, NoPermission } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { FileInput } from "@/components/ui/field-controls";
import { Upload } from "@/components/ui/icons";
import { PageContainer, PageHeader } from "@/components/ui/page";

interface ImportResult {
  created: number;
  skippedDuplicate: number;
  skippedInvalid: number;
  total: number;
}

// Reads ?year= from the URL — sidebar always appends it once at least one
// Award exists (src/components/sidebar.tsx hrefWithYear) — so this stays
// wrapped in Suspense per Next.js's useSearchParams requirement.
function ImportForm() {
  const searchParams = useSearchParams();
  const year = searchParams.get("year");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    result?: ImportResult;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get("file") as File;
    if (!file || file.size === 0) return;

    // どの年度に取り込むか — サイドバーで選択中の年度をそのまま渡す
    // (未指定なら API 側が最新年度にフォールバックする)。
    if (year) formData.set("year", year);

    setUploading(true);
    setResult(null);

    try {
      const res = await fetch("/api/prospects/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ success: false, message: "アップロードに失敗しました" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* 誤って別年度に取り込む事故を防ぐため、取込前に対象年度を明示する。 */}
      <Alert tone="info">
        {year ? (
          <>
            <span className="font-semibold">{year}年度</span> に取り込みます
          </>
        ) : (
          "現在選択中の年度に取り込みます"
        )}
      </Alert>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <div className="space-y-5">
            {/* FileInput 自体が label なので、外側は htmlFor で結ぶ（label の入れ子を避ける） */}
            <Field label="Excelファイル（.xlsx）を選択" htmlFor="prospects-import-file">
              <FileInput id="prospects-import-file" name="file" accept=".xlsx" hint=".xlsx" />
            </Field>
            {/* 取り込み規則は作業前に必ず読む注記なので、薄い文字ではなく Alert で出す */}
            <Alert tone="info">
              シート「メーカーリスト」（無い場合は先頭シート）を読み込みます。列はヘッダー名
              （メーカー名・県名・商品名・サイトで確認できる温度帯・補足・URL）で対応付けます。
              メーカー名＋商品名が同じ年度の既存データと一致する行はスキップされ、コンタクト状況・
              担当者・連絡先・備考・メモ欄など運用中の入力内容が上書きされることはありません
              （他の年度に同じメーカーがあっても、この年度に新規として取り込まれます）。
            </Alert>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button
            variant="primary"
            type="submit"
            disabled={uploading}
            loading={uploading}
            icon={<Upload />}
          >
            {uploading ? "アップロード中..." : "アップロード"}
          </Button>
        </div>
      </form>

      {result && (
        <Alert tone={result.success ? "success" : "danger"}>
          <p>{result.message}</p>
          {result.result && (
            <p className="mt-1 text-caption">
              （内訳: 重複スキップ {result.result.skippedDuplicate}件 / メーカー名未入力スキップ{" "}
              {result.result.skippedInvalid}件）
            </p>
          )}
        </Alert>
      )}
    </div>
  );
}

export default function ProspectsImportPage() {
  const { permissions } = useRole();

  // Part of the 追客リスト feature — canManageProspects gates the page,
  // canUpload gates the import specifically (same convention as
  // src/app/contacts/import/page.tsx).
  if (!permissions.canManageProspects || !permissions.canUpload) {
    return (
      <PageContainer>
        <NoPermission message="インポート権限がありません" />
      </PageContainer>
    );
  }

  return (
    <PageContainer width="form">
      <PageHeader title="追客リスト Excelインポート" backHref="/prospects" backLabel="追客リスト" />
      <Suspense>
        <ImportForm />
      </Suspense>
    </PageContainer>
  );
}
