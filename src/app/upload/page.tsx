"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useRole } from "@/lib/role-context";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, NoPermission } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { FileInput, Input } from "@/components/ui/field-controls";
import { Upload } from "@/components/ui/icons";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { SegmentedControl } from "@/components/ui/segmented-control";

type Mode = "create" | "update";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "create", label: "新規登録" },
  { value: "update", label: "一括更新" },
];

function UploadForm() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [mode, setMode] = useState<Mode>("create");
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultYear = searchParams.get("year") || String(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const { permissions } = useRole();

  if (!permissions.canUpload) {
    return <NoPermission message="アップロード権限がありません" />;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get("csv") as File;
    if (!file || file.size === 0) return;

    formData.set("year", selectedYear);

    setUploading(true);
    setResult(null);

    try {
      const endpoint = mode === "update" ? "/api/upload/update" : "/api/upload";
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResult(data);
      if (data.success) {
        setTimeout(
          () => router.push(`/entries?year=${selectedYear}`),
          1500
        );
      }
    } catch {
      setResult({ success: false, message: "アップロードに失敗しました" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Mode Toggle（切替のたびに result を消す既存挙動は onChange にそのまま） */}
      <SegmentedControl
        value={mode}
        onChange={(next) => { setMode(next); setResult(null); }}
        options={MODE_OPTIONS}
      />

      {mode === "update" && (
        <Alert tone="warning" title="一括更新モード">
          <p>
            受付番号で照合し、CSVに値が入っている項目のみ更新します。空欄の項目は既存データを維持します。
          </p>
          <p className="mt-1">
            手順: エントリー一覧からExcelをダウンロード → 編集 → CSVで保存 → アップロード
          </p>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <div className="space-y-5">
            {/* FileInput 自体が label なので、外側は htmlFor で結ぶ（label の入れ子を避ける） */}
            <Field
              label="CSVファイルを選択"
              htmlFor="upload-csv"
              hint="エントリーデータのCSVファイルをアップロードしてください"
            >
              <FileInput id="upload-csv" name="csv" accept=".csv" hint=".csv" />
            </Field>

            {mode === "create" && (
              <Field
                label="アップロード先の年度"
                hint="新しい年度を入力すると自動的に作成されます"
              >
                <Input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  min="2020"
                  max="2099"
                />
              </Field>
            )}
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
            {uploading
              ? (mode === "update" ? "更新中..." : "アップロード中...")
              : (mode === "update" ? "一括更新する" : "アップロード")
            }
          </Button>
        </div>
      </form>

      {result && (
        <Alert tone={result.success ? "success" : "danger"}>{result.message}</Alert>
      )}
    </div>
  );
}

export default function UploadPage() {
  return (
    <PageContainer width="form">
      {/* Reached from the entries list rather than the sidebar, so it needs its
          own way back — same pattern as the contact lists screen. */}
      <PageHeader title="CSVアップロード" backHref="/entries" backLabel="エントリー一覧" />
      <Suspense>
        <UploadForm />
      </Suspense>
    </PageContainer>
  );
}
