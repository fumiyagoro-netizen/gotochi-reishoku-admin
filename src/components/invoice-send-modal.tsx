"use client";

import { useEffect, useRef, useState } from "react";
import { formatYen } from "@/lib/invoice-shared";

interface FooterSettings {
  senderName: string;
  orgName: string;
  contactEmail: string;
  contactTel: string;
}

interface Props {
  invoiceId: number;
  invoiceNo: string;
  recipientName: string;
  totalAmount: number;
  dueDate: string; // "YYYY-MM-DD"
  defaultTo: string; // entry.email — pre-filled, editable (経理担当が別アドレスのことがあるため)
  sentAt: string | null; // ISO string, or null if never sent
  sentTo: string;
  onClose: () => void;
  onSent: (info: { sentAt: string; sentTo: string; sentBy: string }) => void;
}

// "2026-09-30" -> "2026年9月30日". Pure string arithmetic on a plain
// calendar-date value, deliberately not routed through `new Date(...)` —
// same reasoning as src/lib/invoice-shared.ts#defaultDueDateFromIssueDate:
// dueDate here is a YYYY-MM-DD value with no time/timezone component to get
// wrong, so parsing it as an instant would only add a way to get it wrong.
function formatDateLabel(yyyyMmDd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd);
  if (!m) return yyyyMmDd;
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`;
}

// Rendered client-side, so this runs in the browser's local timezone — but
// every admin using this screen is in Japan, and the underlying instant is
// unambiguous either way. Kept as its own copy rather than importing a
// shared helper: every other JST-formatting spot in this codebase (see
// src/app/email-logs/page.tsx, src/app/logs/page.tsx) does the same
// per-file duplication rather than sharing one formatter.
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

function buildDefaultBody(params: {
  recipientName: string;
  invoiceNo: string;
  totalAmount: number;
  dueDate: string;
  footer: FooterSettings;
}): string {
  const { recipientName, invoiceNo, totalAmount, dueDate, footer } = params;
  const contactLine = footer.contactTel
    ? `${footer.contactEmail} / ${footer.contactTel}`
    : footer.contactEmail;
  return [
    `${recipientName} 様`,
    "",
    "いつもお世話になっております。",
    `${footer.orgName} ${footer.senderName}です。`,
    "",
    "下記の通り請求書をお送りいたしますので、ご確認のほどよろしくお願いいたします。",
    "",
    `請求書番号：${invoiceNo}`,
    `ご請求金額（税込）：${formatYen(totalAmount)}`,
    `お支払期限：${formatDateLabel(dueDate)}`,
    "",
    "ご不明な点がございましたら、本メールへの返信にてお問い合わせください。",
    "どうぞよろしくお願いいたします。",
    "",
    "--",
    footer.orgName,
    footer.senderName,
    contactLine,
  ].join("\n");
}

// 請求書送信モーダル。宛先・件名・本文を確認/編集し、テスト送信で内容を
// 自分で確認してから実送信する（誤送信対策 — src/app/contacts/page.tsx の
// SendModal のテスト送信と同じ考え方）。実送信の直前には必ず二段階確認を
// 挟み（src/components/invoice-form.tsx の削除確認と同じ流儀）、送信中は
// ボタンを無効化して二重送信を防ぐ。
export function InvoiceSendModal({
  invoiceId,
  invoiceNo,
  recipientName,
  totalAmount,
  dueDate,
  defaultTo,
  sentAt,
  sentTo,
  onClose,
  onSent,
}: Props) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(`【ご当地冷凍食品大賞】請求書のご送付（${invoiceNo}）`);
  const [bodyText, setBodyText] = useState("");
  // Ref, not state: read from inside the async fetch().then() below, where a
  // captured state value would be stale (the effect only runs once, so a
  // later setBodyEdited(true) would never be seen there). A ref is always
  // current at the time it's read.
  const bodyEditedRef = useRef(false);

  const [confirmingSend, setConfirmingSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testError, setTestError] = useState("");
  const [testResult, setTestResult] = useState("");

  // 本文の初期値はフッター設定（差出人名・法人名・問い合わせ先）に依存する
  // ため非同期で取得する。取得完了時点でまだユーザーが本文を編集していなければ
  // （bodyEditedRef.current===false）初期値として一度だけ流し込む — 遅れて
  // 届いた設定値で入力中の文面を上書きしないようにするための単純なガード。
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || bodyEditedRef.current) return;
        const footer: FooterSettings = data.success
          ? data.settings
          : { senderName: "", orgName: "", contactEmail: "", contactTel: "" };
        setBodyText(buildDefaultBody({ recipientName, invoiceNo, totalAmount, dueDate, footer }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toValid = to.trim().includes("@");
  const canSend = toValid && !!subject.trim() && !!bodyText.trim();

  async function handleTestSend() {
    setTestSending(true);
    setTestError("");
    setTestResult("");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body: bodyText, testEmail }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult(data.message);
      } else {
        setTestError(data.message || "テスト送信に失敗しました");
      }
    } catch {
      setTestError("テスト送信に失敗しました");
    } finally {
      setTestSending(false);
    }
  }

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    setError("");
    setResult("");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body: bodyText }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.message);
        setConfirmingSend(false);
        onSent(data.invoice);
      } else {
        setError(data.message || "送信に失敗しました");
        setConfirmingSend(false);
      }
    } catch {
      setError("送信に失敗しました");
      setConfirmingSend(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">請求書を送信</h3>
        <p className="text-sm text-gray-500 mb-4">
          {invoiceNo}（{recipientName} 様 / {formatYen(totalAmount)}）のPDFを添付して送信します
        </p>

        {sentAt && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg">
            この請求書は {formatJstDateTime(sentAt)} に {sentTo} へ送信済みです。今回の操作は再送になります。
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg break-words">
            {error}
          </div>
        )}
        {result && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
            {result}
          </div>
        )}

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">宛先</span>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="mt-1 text-xs text-gray-400 block">
              既定はエントリー登録時のメールアドレスです。経理担当者など別アドレス宛の場合はここで変更してください。
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">件名</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">本文</span>
            <textarea
              value={bodyText}
              onChange={(e) => {
                bodyEditedRef.current = true;
                setBodyText(e.target.value);
              }}
              rows={12}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="mt-1 text-xs text-gray-400 block">
              請求書PDF（{invoiceNo}）が添付されます。配信停止リンクは付きません（取引に必要な連絡のため）。
            </span>
          </label>

          {/* Test send */}
          <div className="p-3 border border-gray-200 rounded-lg space-y-2">
            <span className="text-sm font-medium text-gray-700 block">
              テスト送信（自分宛に送って内容を確認できます）
            </span>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleTestSend}
                disabled={testSending || !testEmail.includes("@") || !subject.trim() || !bodyText.trim()}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700
                  hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {testSending ? "送信中..." : "テスト送信"}
              </button>
            </div>
            {testError && <p className="text-sm text-red-600">{testError}</p>}
            {testResult && <p className="text-sm text-green-600">{testResult}</p>}
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              閉じる
            </button>

            {confirmingSend ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-blue-900">
                  {recipientName} 様（{to}）に{sentAt ? "再送" : "送信"}します。よろしいですか？
                </span>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium
                    hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {sending ? "送信中..." : sentAt ? "再送する" : "送信する"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingSend(false)}
                  disabled={sending}
                  className="px-3 py-2 border border-gray-300 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  キャンセル
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingSend(true)}
                disabled={!canSend}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium
                  hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {sentAt ? "再送する" : "送信する"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
