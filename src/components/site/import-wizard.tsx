"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, GrandPrixBadge, PrizeBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";
import { FileInput, Input } from "@/components/ui/field-controls";
import { Table, Th, Td, Tr, Thumb } from "@/components/ui/table";
import { PRIZE_LEVELS, isPrizeLevel } from "@/lib/prize-shared";
import type { ImportRow } from "@/lib/site-import-shared";

// 過去の受賞商品の取り込み画面。① Excel → ② 写真 → ③ 確認 → 取り込み（1品ずつ /api/site/import/entry）

type Preview = { year: number; awardExists: boolean; fileErrors: string[]; rows: ImportRow[] };
type Result = { state: "created" | "skipped" | "error"; message?: string };

const nfc = (s: string) => s.normalize("NFC");

export function ImportWizard({ defaultYear }: { defaultYear: number }) {
  const router = useRouter();
  const [year, setYear] = useState(String(defaultYear));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<Map<string, File>>(new Map());
  const [results, setResults] = useState<Record<string, Result>>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 写真のプレビュー用 URL（選び直したら前のものを解放する）
  const thumbs = useMemo(() => new Map([...files].map(([name, f]) => [name, URL.createObjectURL(f)])), [files]);
  useEffect(() => () => thumbs.forEach((u) => URL.revokeObjectURL(u)), [thumbs]);

  async function onExcel(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPreview(null);
    setResults({});
    setError("");
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("year", year);
      const res = await fetch("/api/site/import/preview", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.success) setError(data.message || "読み込みに失敗しました");
      else setPreview(data);
    } catch {
      setError("読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function onPhotos(e: ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    setFiles(new Map(list.map((f) => [nfc(f.name), f])));
  }

  const rows = preview?.rows ?? [];
  const missingOf = (r: ImportRow) => r.photos.filter((n) => !files.has(nfc(n)));
  const todo = rows.filter((r) => !r.exists && results[r.answerNo]?.state !== "created" && results[r.answerNo]?.state !== "skipped");
  const blocking =
    (preview?.fileErrors.length ?? 0) > 0 || rows.some((r) => r.errors.length > 0) || todo.some((r) => missingOf(r).length > 0);
  const photoCount = todo.reduce((n, r) => n + r.photos.length, 0);
  const done = Object.values(results).filter((r) => r.state === "created").length;
  const failed = Object.values(results).filter((r) => r.state === "error").length;
  const finished = !running && Object.keys(results).length > 0;

  async function run() {
    setConfirmOpen(false);
    setRunning(true);
    setProgress(0);
    for (const [i, r] of todo.entries()) {
      const fd = new FormData();
      fd.append("year", String(preview!.year));
      fd.append("row", JSON.stringify(r));
      for (const name of r.photos) fd.append("photos", files.get(nfc(name))!);
      let result: Result;
      try {
        const res = await fetch("/api/site/import/entry", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        result = data.success ? { state: data.status } : { state: "error", message: data.message || `エラー（${res.status}）` };
      } catch {
        result = { state: "error", message: "通信に失敗しました" };
      }
      setResults((prev) => ({ ...prev, [r.answerNo]: result }));
      setProgress(i + 1);
    }
    setRunning(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Alert tone="info" compact>
        取り込んだ商品は、受賞商品の公開画面で年度を公開にするまで公開サイトには出ません。同じ商品は二重に登録されず、途中で止まってももう一度実行すれば続きから入ります。
      </Alert>

      <Card padding="none" as="section">
        <CardHeader title="1. 取り込み用 Excel" description="「商品名（評価シート）」の列がある表を読みます。読むだけで、この時点では何も保存しません。" />
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <label htmlFor="import-year" className="text-sm font-medium text-ink">
              取り込み先の年度
            </label>
            <div className="w-28">
              <Input
                id="import-year"
                type="number"
                size="sm"
                value={year}
                disabled={running}
                onChange={(e) => {
                  setYear(e.target.value);
                  setPreview(null);
                  setResults({});
                }}
              />
            </div>
            <span className="text-caption text-ink-subtle">年度（第1回 2024-2025 は 2025年度）</span>
          </div>
          <FileInput accept=".xlsx" hint=".xlsx" disabled={running || loading} onChange={onExcel} />
          {loading && <p className="text-caption text-ink-subtle">読み込み中…</p>}
          {error && (
            <Alert tone="danger" compact>
              {error}
            </Alert>
          )}
        </div>
      </Card>

      {preview && (
        <Card padding="none" as="section">
          <CardHeader
            title="2. 写真"
            description="Excel の写真欄に書いた名前のファイルを、まとめて選んでください（フォルダを開いて全選択）。"
          />
          <div className="space-y-2 p-5">
            <FileInput accept="image/*" multiple hint="複数選べます" disabled={running} onChange={onPhotos} />
            <p className="text-caption text-ink-subtle">
              選んだ写真 {files.size}枚／取り込む商品に必要な写真 {photoCount}枚
            </p>
          </div>
        </Card>
      )}

      {preview && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">3. 確認して取り込む</h2>
              <p className="text-caption text-ink-subtle">
                {preview.year}年度{preview.awardExists ? "" : "（まだ無いので新しく作ります）"}・{rows.length}品（
                {PRIZE_LEVELS.map((p) => `${p} ${rows.filter((r) => r.prizeLevel === p).length}`).join("・")}
                ）{rows.some((r) => r.exists) && `・取り込み済み ${rows.filter((r) => r.exists).length}品`}
              </p>
            </div>
            <Button
              variant="primary"
              disabled={blocking || running || todo.length === 0}
              loading={running}
              onClick={() => setConfirmOpen(true)}
            >
              {running ? `取り込み中 ${progress} / ${todo.length}` : `${todo.length}品を取り込む`}
            </Button>
          </div>

          {preview.fileErrors.map((m) => (
            <Alert key={m} tone="danger" compact>
              {m}
            </Alert>
          ))}
          {blocking && preview.fileErrors.length === 0 && (
            <Alert tone="warning" compact>
              赤い「要修正」や「写真が足りない」行があるうちは取り込めません。Excel を直して読み込み直すか、写真を選び直してください。
            </Alert>
          )}
          {finished && (
            <Alert tone={failed > 0 ? "warning" : "success"} compact>
              {done}品を登録しました{failed > 0 && `。${failed}品は登録できませんでした（理由は一覧の「状態」）。もう一度「取り込む」を押すと、残りだけを登録します`}。{" "}
              <Link href={`/entries?year=${preview.year}`} className="font-medium underline">
                エントリー一覧で見る
              </Link>
              {" ／ "}
              <Link href={`/site/winners?year=${preview.year}`} className="font-medium underline">
                受賞商品の公開で見る
              </Link>
            </Alert>
          )}

          <Table>
            <thead>
              <tr>
                <Th width="w-12">No</Th>
                <Th>賞</Th>
                <Th>商品名・企業名</Th>
                <Th>都道府県</Th>
                <Th>写真</Th>
                <Th>状態</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const missing = missingOf(r);
                const result = results[r.answerNo];
                return (
                  <Tr key={r.answerNo} muted={r.exists}>
                    <Td numeric>{r.no}</Td>
                    <Td nowrap>
                      <div className="flex flex-wrap items-center gap-1">
                        {isPrizeLevel(r.prizeLevel) ? <PrizeBadge prizeLevel={r.prizeLevel} size="sm" /> : <Badge tone="danger" size="sm">{r.prizeLevel || "賞なし"}</Badge>}
                        {r.grandPrix && <GrandPrixBadge size="sm" />}
                      </div>
                      {r.specialAward && <p className="mt-0.5 text-caption text-ink-subtle">{r.specialAward}</p>}
                    </Td>
                    <Td primary>
                      {r.productName}
                      <p className="text-caption font-normal text-ink-subtle">{r.companyName}</p>
                    </Td>
                    <Td nowrap>{r.prefecture || <Badge tone="outline" size="sm">未入力</Badge>}</Td>
                    <Td>
                      <div className="flex gap-1">
                        {r.photos.map((name) => (
                          <span key={name} title={name}>
                            <Thumb src={thumbs.get(nfc(name))} alt={name} />
                          </span>
                        ))}
                      </div>
                    </Td>
                    <Td>
                      <RowState row={r} missing={missing} result={result} />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </section>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`${todo.length}品を取り込みます`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              キャンセル
            </Button>
            <Button variant="primary" onClick={run}>
              取り込む
            </Button>
          </>
        }
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
          <li>
            {preview?.year}年度{preview?.awardExists ? "" : "を新しく作り、"}に{todo.length}品を登録し、写真{photoCount}枚を保存します。
          </li>
          <li>1品ずつ登録します。終わるまでこの画面を閉じないでください。</li>
          <li>公開サイトには、受賞商品の公開画面で年度を公開にするまで出ません。</li>
        </ul>
      </Modal>
    </div>
  );
}

function RowState({ row, missing, result }: { row: ImportRow; missing: string[]; result?: Result }) {
  if (result?.state === "created") return <Badge tone="success" size="sm">登録しました</Badge>;
  if (result?.state === "skipped" || row.exists) return <Badge tone="outline" size="sm">取り込み済み</Badge>;
  if (result?.state === "error")
    return (
      <div>
        <Badge tone="danger" size="sm">登録できませんでした</Badge>
        <p className="mt-0.5 text-caption text-danger-ink">{result.message}</p>
      </div>
    );
  if (row.errors.length > 0)
    return (
      <div>
        <Badge tone="danger" size="sm">要修正</Badge>
        <p className="mt-0.5 text-caption text-danger-ink">{row.errors.join("／")}</p>
      </div>
    );
  if (missing.length > 0)
    return (
      <div>
        <Badge tone="warning" size="sm">写真が足りない</Badge>
        <p className="mt-0.5 break-all text-caption text-warning-ink">{missing.join("、")}</p>
      </div>
    );
  return (
    <div>
      <Badge tone="neutral" size="sm">取り込み待ち</Badge>
      {row.warnings.length > 0 && <p className="mt-0.5 text-caption text-ink-subtle">{row.warnings.join("／")}</p>}
    </div>
  );
}
