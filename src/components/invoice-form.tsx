"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_UNIT,
  DEFAULT_INVOICE_NOTES,
  defaultDueDateFromIssueDate,
  calcInvoiceTotals,
  formatYen,
} from "@/lib/invoice-shared";
import { InvoiceSendModal } from "@/components/invoice-send-modal";
import { Card, CardHeader } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/field-controls";
import { KeyValueList, KeyValue } from "@/components/ui/key-value";
import { Th, Td, Tr } from "@/components/ui/table";
import { InlineConfirm } from "@/components/ui/inline-confirm";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import {
  Search,
  Pencil,
  Plus,
  ChevronUp,
  ChevronDown,
  X,
  Trash2,
  FileText,
  Download,
  Send,
} from "@/components/ui/icons";

interface EntrySummary {
  id: number;
  answerNo: string;
  companyName: string;
  productName: string;
  contactLastName: string;
  contactFirstName: string;
  email: string;
  award: { year: number };
}

interface InvoiceItemMaster {
  id: number;
  name: string;
  unitPrice: number;
  isActive: boolean;
}

// A numeric field being edited can legitimately hold text that isn't a number
// yet — "" while the field is being cleared, or a lone "-" before the digits.
// Coercing on every keystroke forced those back to 0, which left a 0 that
// couldn't be deleted and made negative amounts impossible to enter. The
// inputs keep what was typed; this resolves it where a number is needed.
function toNum(v: number | string): number {
  const n = typeof v === "number" ? v : parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

export interface InvoiceLineData {
  date: string; // "YYYY-MM-DD"
  name: string;
  quantity: number | string;
  unit: string;
  unitPrice: number | string;
}

export interface InvoiceData {
  id: number;
  invoiceNo: string;
  recipientName: string;
  issueDate: string; // "YYYY-MM-DD"
  dueDate: string;
  notes: string;
  lines: InvoiceLineData[];
  entry: EntrySummary;
  // 送付状況（prisma/schema.prisma の Invoice.sentAt 等参照）。新規作成フォーム
  // （initial 未指定）では常に未送信なので、これらは編集画面からの初期値
  // 読み込み時のみ渡される。
  sentAt?: string | null;
  sentTo?: string;
  sentBy?: string;
}

// src/app/email-logs/page.tsx や src/app/logs/page.tsx と同じ「サーバーは
// UTC で動くため timeZone を明示しないと9時間ずれる」注意点に対する対応。
// 各ファイルでこの小さなフォーマッタを個別に持つのは、このコードベース既存の
// やり方（共通ヘルパーに寄せていない）に合わせている。
function formatJstDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function todayJst(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

function newBlankLine(dateStr: string): InvoiceLineData {
  return { date: dateStr, name: "", quantity: 1, unit: DEFAULT_UNIT, unitPrice: 0 };
}

// メール送信APIは金額・明細をDBから読み直して都度PDFを作り直す（クライアント
// からの値は信用しない — src/app/api/invoices/[id]/send/route.ts 参照）。つまり
// 「保存」せずに明細を編集した状態で送信すると、送信モーダルに見えている金額と
// 実際に添付されるPDFの金額がずれてしまう。このフィンガープリントは「今の
// フォームの内容」と「最後に保存した内容」を比較するためだけに使い、両者が
// 一致しているとき（＝保存済み）だけ送信ボタンを有効にする。
function invoiceFingerprint(data: {
  recipientName: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  invoiceNo: string;
  lines: InvoiceLineData[];
}): string {
  return JSON.stringify({
    recipientName: data.recipientName,
    issueDate: data.issueDate,
    dueDate: data.dueDate,
    notes: data.notes,
    invoiceNo: data.invoiceNo,
    lines: data.lines.map((l) => ({
      date: l.date,
      name: l.name,
      quantity: toNum(l.quantity),
      unit: l.unit,
      unitPrice: toNum(l.unitPrice),
    })),
  });
}

export function InvoiceForm({ initial }: { initial?: InvoiceData }) {
  const router = useRouter();
  // The entry search must stay inside the year selected in the sidebar.
  // Without it the API falls back to the newest award, so picking 2026年度
  // still searched 2027 entries — no 2026 company could be found, and any
  // invoice created from that search belonged to the wrong year.
  const searchParams = useSearchParams();
  const year = searchParams.get("year");
  const isEdit = !!initial;

  const [entry, setEntry] = useState<EntrySummary | null>(initial?.entry ?? null);
  const [entryQuery, setEntryQuery] = useState("");
  const [entryResults, setEntryResults] = useState<EntrySummary[]>([]);
  const [searchingEntry, setSearchingEntry] = useState(false);

  const [recipientName, setRecipientName] = useState(initial?.recipientName ?? "");
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? todayJst());
  const [dueDate, setDueDate] = useState(
    initial?.dueDate ?? defaultDueDateFromIssueDate(todayJst())
  );
  // 発行日を変えたら支払期限（初期値=翌月末）も追従させるかどうか。ユーザーが
  // 一度でも支払期限を手で編集したら追従をやめる（イレギュラー対応で手入力
  // した値を、発行日をいじっただけで勝手に上書きしないため）。編集画面では
  // 最初から保存済みの値があるので追従させない。
  const [dueDateTouched, setDueDateTouched] = useState(isEdit);
  const [invoiceNo, setInvoiceNo] = useState(initial?.invoiceNo ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? DEFAULT_INVOICE_NOTES);
  const [lines, setLines] = useState<InvoiceLineData[]>(
    initial?.lines && initial.lines.length > 0 ? initial.lines : [newBlankLine(initial?.issueDate ?? todayJst())]
  );

  const [masterItems, setMasterItems] = useState<InvoiceItemMaster[]>([]);
  const [selectedMasterId, setSelectedMasterId] = useState<string>("");

  // 送付状況。保存フォームの他のフィールドと違い送信APIが直接更新するので
  // （src/app/api/invoices/[id]/send/route.ts）、保存(handleSubmit)の対象には
  // 含めない — 「保存する」を押しても送付状況が変わらないのはこの通り正しい
  // 挙動で、意図的に外している。
  const [sentAt, setSentAt] = useState<string | null>(initial?.sentAt ?? null);
  const [sentTo, setSentTo] = useState(initial?.sentTo ?? "");
  const [showSendModal, setShowSendModal] = useState(false);

  // 最後に保存した内容のフィンガープリント。「保存する」成功時に handleSubmit
  // が更新する（invoiceFingerprint のコメント参照）。
  const [savedFingerprint, setSavedFingerprint] = useState(() =>
    initial
      ? invoiceFingerprint({
          recipientName: initial.recipientName,
          issueDate: initial.issueDate,
          dueDate: initial.dueDate,
          notes: initial.notes,
          invoiceNo: initial.invoiceNo,
          lines: initial.lines,
        })
      : ""
  );
  const hasUnsavedChanges =
    isEdit &&
    invoiceFingerprint({ recipientName, issueDate, dueDate, notes, invoiceNo, lines }) !== savedFingerprint;

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/invoice-items")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setMasterItems((data.items as InvoiceItemMaster[]).filter((i) => i.isActive));
      });
  }, []);

  function handleIssueDateChange(value: string) {
    setIssueDate(value);
    if (!dueDateTouched) {
      setDueDate(defaultDueDateFromIssueDate(value));
    }
  }

  const searchEntries = useCallback(async () => {
    setSearchingEntry(true);
    try {
      const params = new URLSearchParams();
      if (year) params.set("year", year);
      if (entryQuery) params.set("q", entryQuery);
      const res = await fetch(`/api/invoices/entries?${params.toString()}`);
      const data = await res.json();
      if (data.success) setEntryResults(data.entries);
    } finally {
      setSearchingEntry(false);
    }
  }, [entryQuery, year]);

  function selectEntry(e: EntrySummary) {
    setEntry(e);
    setEntryResults([]);
    if (!recipientName) setRecipientName(e.companyName);
  }

  function addLineFromMaster() {
    const item = masterItems.find((i) => String(i.id) === selectedMasterId);
    if (!item) return;
    setLines((prev) => [
      ...prev,
      { date: issueDate, name: item.name, quantity: 1, unit: DEFAULT_UNIT, unitPrice: item.unitPrice },
    ]);
    setSelectedMasterId("");
  }

  function addBlankLine() {
    setLines((prev) => [...prev, newBlankLine(issueDate)]);
  }

  function updateLine(index: number, patch: Partial<InvoiceLineData>) {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function moveLine(index: number, direction: -1 | 1) {
    setLines((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  // quantity/unitPrice are held as typed text while editing (see the inputs
  // below), so coerce here rather than trusting them to be numbers.
  const totals = calcInvoiceTotals(
    lines.map((l) => ({ quantity: toNum(l.quantity), unitPrice: toNum(l.unitPrice) }))
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entry) {
      setError("対象エントリーを選択してください");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const payload: Record<string, unknown> = {
        recipientName,
        issueDate,
        dueDate,
        notes,
        lines: lines.map((l) => ({
          ...l,
          quantity: toNum(l.quantity),
          unitPrice: toNum(l.unitPrice),
        })),
      };
      if (!isEdit) {
        payload.entryId = entry.id;
        if (invoiceNo.trim()) payload.invoiceNo = invoiceNo.trim();
      } else if (invoiceNo !== initial!.invoiceNo) {
        payload.invoiceNo = invoiceNo;
      }

      const res = await fetch(isEdit ? `/api/invoices/${initial!.id}` : "/api/invoices", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSavedFingerprint(
          invoiceFingerprint({ recipientName, issueDate, dueDate, notes, invoiceNo, lines })
        );
        router.push(`/invoices/${data.invoice.id}/edit`);
        router.refresh();
      } else {
        setError(data.message);
      }
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initial) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${initial.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        router.push("/invoices");
      } else {
        setError(data.message);
      }
    } catch {
      setError("削除に失敗しました");
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  // 最上部と sticky バー直上に同じエラーを出す（明細を編集中でも気づけるように）
  const errorAlert = error ? <Alert tone="danger">{error}</Alert> : null;

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorAlert}

      {/* 対象エントリー */}
      <Card padding="none">
        <CardHeader
          title="対象エントリー"
          actions={
            entry && !isEdit && (
              <Button variant="ghost" size="sm" icon={<Pencil />} onClick={() => setEntry(null)}>
                変更
              </Button>
            )
          }
        />
        <div className="p-5">
          {entry ? (
            <KeyValueList>
              <KeyValue label="企業名">{entry.companyName}</KeyValue>
              <KeyValue label="担当者">
                {entry.contactLastName}
                {entry.contactFirstName} / {entry.email}
              </KeyValue>
              <KeyValue label="エントリー">
                {entry.award.year}年度エントリー（回答番号: {entry.answerNo}）
              </KeyValue>
            </KeyValueList>
          ) : (
            <div>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <Input
                    type="text"
                    value={entryQuery}
                    onChange={(e) => setEntryQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        searchEntries();
                      }
                    }}
                    placeholder="企業名・商品名・担当者名・メールアドレスで検索"
                    leadingIcon={<Search />}
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={searchEntries}
                  disabled={searchingEntry}
                  loading={searchingEntry}
                >
                  {searchingEntry ? "検索中..." : "検索"}
                </Button>
              </div>
              {entryResults.length > 0 && (
                <ul className="mt-3 max-h-64 divide-y divide-line overflow-y-auto rounded-md border border-line">
                  {entryResults.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => selectEntry(r)}
                        className="w-full px-4 py-2.5 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:bg-surface-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
                      >
                        <div className="text-sm font-medium text-ink">{r.companyName}</div>
                        <div className="text-caption text-ink-muted">{r.productName}</div>
                        <div className="text-caption text-ink-subtle">
                          {r.contactLastName}
                          {r.contactFirstName} / {r.email} / {r.award.year}年度
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ヘッダー情報 */}
      <Card>
        <div className="space-y-5">
          <Field
            label="宛名"
            hint={`PDF・画面には「${recipientName || "（宛名）"} 様」と表示されます`}
          >
            <Input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              required
              placeholder="株式会社◯◯"
            />
          </Field>

          <div className="grid grid-cols-3 gap-x-6 gap-y-5">
            <Field label="発行日">
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => handleIssueDateChange(e.target.value)}
                required
              />
            </Field>
            <Field label="支払期限" labelHint="（既定: 発行月の翌月末）">
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setDueDateTouched(true);
                }}
                required
              />
            </Field>
            <Field label="書類番号" labelHint="（空欄なら自動採番）">
              <Input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="IN202608-0001"
              />
            </Field>
          </div>
        </div>
      </Card>

      {/* 明細 */}
      <Card padding="none">
        <CardHeader
          title="明細"
          actions={
            <>
              <div className="w-64">
                <Select
                  size="sm"
                  value={selectedMasterId}
                  onChange={(e) => setSelectedMasterId(e.target.value)}
                >
                  <option value="">請求項目マスタから選択...</option>
                  {masterItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}（{formatYen(item.unitPrice)}）
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus />}
                onClick={addLineFromMaster}
                disabled={!selectedMasterId}
              >
                追加
              </Button>
              <Button variant="secondary" size="sm" icon={<Plus />} onClick={addBlankLine}>
                空の行を追加
              </Button>
            </>
          }
        />

        {/* Card を二重にしないため Table 部品ではなく素の table に Th / Td / Tr を使う */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm [&_td]:py-1.5">
            <thead>
              <tr>
                <Th width="w-36">日付</Th>
                <Th>品名</Th>
                <Th width="w-20">数量</Th>
                <Th width="w-16">単位</Th>
                <Th align="right" width="w-28">単価</Th>
                <Th align="right" width="w-28">金額</Th>
                <Th width="w-24" srLabel="操作" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <Tr key={i}>
                  <Td>
                    <Input
                      size="sm"
                      type="date"
                      value={line.date}
                      onChange={(e) => updateLine(i, { date: e.target.value })}
                      required
                    />
                  </Td>
                  <Td>
                    <Input
                      size="sm"
                      type="text"
                      value={line.name}
                      onChange={(e) => updateLine(i, { name: e.target.value })}
                      required
                    />
                  </Td>
                  <Td>
                    <Input
                      size="sm"
                      type="number"
                      value={line.quantity}
                      onChange={(e) => updateLine(i, { quantity: e.target.value })}
                      min={1}
                      required
                    />
                  </Td>
                  <Td>
                    <Input
                      size="sm"
                      type="text"
                      value={line.unit}
                      onChange={(e) => updateLine(i, { unit: e.target.value })}
                    />
                  </Td>
                  <Td>
                    <Input
                      size="sm"
                      type="number"
                      align="right"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                      required
                    />
                  </Td>
                  {/* 金額は行の主要な数値なので補助色ではなく本文色 */}
                  <Td numeric tone="ink">
                    {formatYen(toNum(line.quantity) * toNum(line.unitPrice))}
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        size="sm"
                        label="上へ"
                        icon={<ChevronUp />}
                        onClick={() => moveLine(i, -1)}
                        disabled={i === 0}
                      />
                      <IconButton
                        size="sm"
                        label="下へ"
                        icon={<ChevronDown />}
                        onClick={() => moveLine(i, 1)}
                        disabled={i === lines.length - 1}
                      />
                      <IconButton
                        size="sm"
                        tone="danger"
                        label="削除"
                        icon={<X />}
                        onClick={() => removeLine(i)}
                        disabled={lines.length <= 1}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end border-t border-line px-5 py-4">
          <div className="w-64 space-y-1.5 text-sm">
            <div className="flex justify-between text-ink-muted">
              <span>合計（税抜）</span>
              <span className="tabular-nums">{formatYen(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-ink-muted">
              <span>消費税（10%・切り捨て）</span>
              <span className="tabular-nums">{formatYen(totals.taxAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-1.5 font-semibold text-ink">
              <span>合計金額</span>
              <span className="tabular-nums">{formatYen(totals.totalAmount)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 送付状況 — 保存前の新規作成フォームには表示しない（isEdit のときのみ送信可能） */}
      {isEdit && (
        <Card padding="none">
          <CardHeader title="送付状況" />
          <div className="space-y-3 p-5">
            {sentAt ? (
              <p className="text-sm text-ink">
                送信済み：{formatJstDateTime(sentAt)} → {sentTo}
              </p>
            ) : (
              <p className="text-sm text-ink-subtle">未送信</p>
            )}
            {hasUnsavedChanges && (
              <Alert tone="warning" compact>
                未保存の変更があります。保存すると送信できるようになります（送信メールには保存済みの内容が添付されます）。
              </Alert>
            )}
          </div>
        </Card>
      )}

      {/* 備考 */}
      <Card>
        <Field label="備考">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
        </Field>
      </Card>

      {/* アクション */}
      <StickyActionBar
        error={errorAlert}
        start={
          isEdit && (
            confirmingDelete ? (
              <InlineConfirm
                message="本当に削除しますか？"
                confirmLabel="削除する"
                loadingLabel="削除中..."
                loading={deleting}
                onConfirm={handleDelete}
                onCancel={() => setConfirmingDelete(false)}
              />
            ) : (
              <Button variant="dangerGhost" icon={<Trash2 />} onClick={() => setConfirmingDelete(true)}>
                削除
              </Button>
            )
          )
        }
      >
        {isEdit && (
          <>
            {/* PDF は API 経由の <a href> のまま（next/link を通さない） */}
            <ButtonLink
              variant="secondary"
              href={`/api/invoices/${initial!.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              icon={<FileText />}
            >
              PDFプレビュー
            </ButtonLink>
            <ButtonLink
              variant="secondary"
              href={`/api/invoices/${initial!.id}/pdf?download=1`}
              external
              icon={<Download />}
            >
              PDFダウンロード
            </ButtonLink>
            <Button
              variant="secondary"
              icon={<Send />}
              onClick={() => setShowSendModal(true)}
              disabled={hasUnsavedChanges}
              title={hasUnsavedChanges ? "未保存の変更があります。先に保存してください" : undefined}
            >
              {sentAt ? "請求書を再送" : "請求書を送信"}
            </Button>
          </>
        )}
        <Button variant="primary" type="submit" disabled={saving} loading={saving}>
          {saving ? "保存中..." : "保存する"}
        </Button>
      </StickyActionBar>
    </form>

    {isEdit && showSendModal && (
      <InvoiceSendModal
        invoiceId={initial!.id}
        invoiceNo={initial!.invoiceNo}
        recipientName={recipientName}
        totalAmount={totals.totalAmount}
        dueDate={dueDate}
        defaultTo={initial!.entry.email}
        sentAt={sentAt}
        sentTo={sentTo}
        onClose={() => setShowSendModal(false)}
        onSent={(info) => {
          setSentAt(info.sentAt);
          setSentTo(info.sentTo);
        }}
      />
    )}
    </>
  );
}
