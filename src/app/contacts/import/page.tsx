"use client";

import { useState, useEffect, Suspense } from "react";
import { useRole } from "@/lib/role-context";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, NoPermission } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { FileInput, Select } from "@/components/ui/field-controls";
import { Download, Upload } from "@/components/ui/icons";
import { PageContainer, PageHeader } from "@/components/ui/page";

interface ContactListRow {
  id: number;
  name: string;
}

function ImportForm() {
  const { permissions } = useRole();
  const [lists, setLists] = useState<ContactListRow[]>([]);
  const [listId, setListId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [importingEntries, setImportingEntries] = useState(false);
  const [entryResult, setEntryResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/contacts/lists")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setLists(data.lists);
      });
  }, []);

  // Part of the contacts feature (canManageContacts) — an editor still has
  // canUpload=true (used for the unrelated entries CSV upload), so checking
  // canUpload alone would let editor reach this page. Both must hold.
  if (!permissions.canManageContacts || !permissions.canUpload) {
    return <NoPermission message="インポート権限がありません" />;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get("csv") as File;
    if (!file || file.size === 0) return;

    if (listId) formData.set("listId", listId);

    setUploading(true);
    setResult(null);

    try {
      const res = await fetch("/api/contacts/import", {
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

  async function handleImportEntries() {
    setImportingEntries(true);
    setEntryResult(null);
    try {
      const res = await fetch("/api/contacts/import-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setEntryResult(data);
    } catch {
      setEntryResult({ success: false, message: "取り込みに失敗しました" });
    } finally {
      setImportingEntries(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* CSV Import */}
      <div className="space-y-4">
        <form onSubmit={handleSubmit}>
          <Card padding="none">
            <CardHeader title="CSVファイルからインポート" />
            <div className="space-y-5 p-5">
              {/* FileInput 自体が label なので、外側は htmlFor で結ぶ（label の入れ子を避ける） */}
              <Field label="CSVファイルを選択" htmlFor="contacts-import-csv">
                <FileInput id="contacts-import-csv" name="csv" accept=".csv" hint=".csv" />
              </Field>
              {/* 取り込み前に必ず読む列仕様なので、薄い注記ではなく Alert で出す */}
              <Alert tone="info">列: email（必須）, name, companyName, phone</Alert>

              <Field label="追加先のリスト（任意）">
                <Select
                  value={listId}
                  onChange={(e) => setListId(e.target.value)}
                >
                  <option value="">リストに追加しない</option>
                  {lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <CardFooter>
              <Button
                variant="primary"
                type="submit"
                disabled={uploading}
                loading={uploading}
                icon={<Upload />}
              >
                {uploading ? "アップロード中..." : "アップロード"}
              </Button>
            </CardFooter>
          </Card>
        </form>

        {result && (
          <Alert tone={result.success ? "success" : "danger"}>{result.message}</Alert>
        )}
      </div>

      {/* Import from Entries */}
      <div className="space-y-4">
        <Card padding="none">
          <CardHeader title="既存応募者を取り込む" />
          <div className="p-5">
            <p className="text-sm text-ink-muted">
              <strong className="font-semibold text-ink">全年度</strong>のエントリーをメールアドレスで名寄せし、連絡先として取り込みます。
              同じ担当者は1件にまとまり、年度ごとに「&lt;年度&gt; 応募者」リスト（絞り込み用）へ自動振り分けされます。
            </p>
            <p className="mt-2 text-caption leading-5 text-ink-subtle">
              ※ 今後の新規エントリーは自動で連絡先に追加されます。この取り込みは既存分の一括登録用です。
            </p>
          </div>
          <CardFooter>
            <Button
              variant="primary"
              onClick={handleImportEntries}
              disabled={importingEntries}
              loading={importingEntries}
              icon={<Download />}
            >
              {importingEntries ? "取り込み中..." : "全年度の応募者を取り込む"}
            </Button>
          </CardFooter>
        </Card>

        {entryResult && (
          <Alert tone={entryResult.success ? "success" : "danger"}>{entryResult.message}</Alert>
        )}
      </div>
    </div>
  );
}

export default function ContactsImportPage() {
  return (
    <PageContainer width="form">
      <PageHeader title="連絡先インポート" backHref="/contacts" backLabel="連絡先一覧" />
      <Suspense>
        <ImportForm />
      </Suspense>
    </PageContainer>
  );
}
