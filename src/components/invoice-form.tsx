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

  const inputClass =
    "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg break-words">
          {error}
        </div>
      )}

      {/* 対象エントリー */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">対象エントリー</h3>
        {entry ? (
          <div className="flex items-start justify-between">
            <div>
              <div className="text-base font-medium text-gray-900">{entry.companyName}</div>
              <div className="text-sm text-gray-500">
                {entry.contactLastName}
                {entry.contactFirstName} / {entry.email}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {entry.award.year}年度エントリー（回答番号: {entry.answerNo}）
              </div>
            </div>
            {!isEdit && (
              <button
                type="button"
                onClick={() => setEntry(null)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50"
              >
                変更
              </button>
            )}
          </div>
        ) : (
          <div>
            <div className="flex gap-2">
              <input
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={searchEntries}
                disabled={searchingEntry}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium
                  hover:bg-blue-700 disabled:opacity-50"
              >
                {searchingEntry ? "検索中..." : "検索"}
              </button>
            </div>
            {entryResults.length > 0 && (
              <ul className="mt-3 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {entryResults.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => selectEntry(r)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="text-sm font-medium text-gray-900">{r.companyName}</div>
                      <div className="text-xs text-gray-700">{r.productName}</div>
                      <div className="text-xs text-gray-500">
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

      {/* ヘッダー情報 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">宛名</span>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            required
            placeholder="株式会社◯◯"
            className={inputClass}
          />
          <span className="text-xs text-gray-400 mt-1 block">PDF・画面には「{recipientName || "（宛名）"} 様」と表示されます</span>
        </label>

        <div className="grid grid-cols-3 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">発行日</span>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => handleIssueDateChange(e.target.value)}
              required
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              支払期限
              <span className="ml-1 text-xs text-gray-400 font-normal">（既定: 発行月の翌月末）</span>
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                setDueDateTouched(true);
              }}
              required
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              書類番号
              <span className="ml-1 text-xs text-gray-400 font-normal">（空欄なら自動採番）</span>
            </span>
            <input
              type="text"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              placeholder="IN202608-0001"
              className={inputClass}
            />
          </label>
        </div>
      </div>

      {/* 明細 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-700">明細</h3>
          <div className="flex items-center gap-2">
            <select
              value={selectedMasterId}
              onChange={(e) => setSelectedMasterId(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">請求項目マスタから選択...</option>
              {masterItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}（{formatYen(item.unitPrice)}）
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addLineFromMaster}
              disabled={!selectedMasterId}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700
                hover:bg-gray-50 disabled:opacity-50"
            >
              + 追加
            </button>
            <button
              type="button"
              onClick={addBlankLine}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50"
            >
              + 空の行を追加
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 uppercase w-36">日付</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 uppercase">品名</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 uppercase w-20">数量</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 uppercase w-16">単位</th>
                <th className="text-right px-2 py-2 text-xs font-medium text-gray-500 uppercase w-28">単価</th>
                <th className="text-right px-2 py-2 text-xs font-medium text-gray-500 uppercase w-28">金額</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((line, i) => (
                <tr key={i}>
                  <td className="px-2 py-2">
                    <input
                      type="date"
                      value={line.date}
                      onChange={(e) => updateLine(i, { date: e.target.value })}
                      required
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={line.name}
                      onChange={(e) => updateLine(i, { name: e.target.value })}
                      required
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={line.quantity}
                      onChange={(e) => updateLine(i, { quantity: e.target.value })}
                      min={1}
                      required
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={line.unit}
                      onChange={(e) => updateLine(i, { unit: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                      required
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs text-right"
                    />
                  </td>
                  <td className="px-2 py-2 text-right text-xs text-gray-700 whitespace-nowrap">
                    {formatYen(toNum(line.quantity) * toNum(line.unitPrice))}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => moveLine(i, -1)}
                        disabled={i === 0}
                        className="px-1.5 py-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        title="上へ"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLine(i, 1)}
                        disabled={i === lines.length - 1}
                        className="px-1.5 py-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        title="下へ"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        disabled={lines.length <= 1}
                        className="px-1.5 py-1 text-red-400 hover:text-red-700 disabled:opacity-30"
                        title="削除"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-4">
          <div className="w-64 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>合計（税抜）</span>
              <span>{formatYen(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>消費税（10%・切り捨て）</span>
              <span>{formatYen(totals.taxAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold text-gray-900 pt-1.5 border-t border-gray-200">
              <span>合計金額</span>
              <span>{formatYen(totals.totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 送付状況 — 保存前の新規作成フォームには表示しない（isEdit のときのみ送信可能） */}
      {isEdit && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">送付状況</h3>
          {sentAt ? (
            <p className="text-sm text-gray-700">
              送信済み：{formatJstDateTime(sentAt)} → {sentTo}
            </p>
          ) : (
            <p className="text-sm text-gray-400">未送信</p>
          )}
          {hasUnsavedChanges && (
            <p className="text-xs text-amber-600 mt-1">
              未保存の変更があります。保存すると送信できるようになります（送信メールには保存済みの内容が添付されます）。
            </p>
          )}
        </div>
      )}

      {/* 備考 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">備考</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className={inputClass}
          />
        </label>
      </div>

      {/* アクション */}
      <div className="flex items-center justify-between gap-2">
        <div>
          {isEdit && (
            confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">本当に削除しますか？</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg
                    hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "削除中..." : "削除する"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="px-3 py-1.5 border border-gray-300 text-sm text-gray-600 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50"
              >
                削除
              </button>
            )
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <>
              <a
                href={`/api/invoices/${initial!.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                PDFプレビュー
              </a>
              <a
                href={`/api/invoices/${initial!.id}/pdf?download=1`}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                📥 PDFダウンロード
              </a>
              <button
                type="button"
                onClick={() => setShowSendModal(true)}
                disabled={hasUnsavedChanges}
                title={hasUnsavedChanges ? "未保存の変更があります。先に保存してください" : undefined}
                className="px-4 py-2 border border-blue-300 text-blue-700 rounded-lg text-sm
                  hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sentAt ? "請求書を再送" : "請求書を送信"}
              </button>
            </>
          )}
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium
              hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "保存中..." : "保存する"}
          </button>
        </div>
      </div>
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
