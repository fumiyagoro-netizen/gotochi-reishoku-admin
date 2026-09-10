"use client";

import { useEffect, useRef, useState } from "react";
import { formatYen } from "@/lib/invoice-shared";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/field-controls";
import { Send } from "@/components/ui/icons";

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
  // Shown before sending because the CC is visible to the customer and the
  // send is irreversible — who else receives it should be on screen, not
  // implied. Test sends copy nobody, so this is only about the real send.
  const [ccRecipients, setCcRecipients] = useState<string[]>([]);
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

  useEffect(() => {
    fetch("/api/invoices/cc-recipients")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setCcRecipients(data.ccRecipients);
      })
      .catch(() => {
        // Non-fatal: the send still copies them server-side. Only the
        // on-screen preview of the CC list is lost.
      });
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
    // 入力途中の本文を失わないよう、背景クリック・Esc では閉じない（既存どおり）
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="請求書を送信"
      description={`${invoiceNo}（${recipientName} 様 / ${formatYen(totalAmount)}）のPDFを添付して送信します`}
      footerStart={
        <Button variant="secondary" onClick={onClose}>
          閉じる
        </Button>
      }
      footer={
        confirmingSend ? (
          <div
            role="group"
            className="inline-flex flex-wrap items-center justify-end gap-2 rounded-md border border-accent-line bg-accent-soft px-3 py-1.5 text-sm text-ink"
          >
            <span>
              {recipientName} 様（{to}）
              {ccRecipients.length > 0 ? `／CC: ${ccRecipients.join("、")}` : ""}
              に{sentAt ? "再送" : "送信"}します。よろしいですか？
            </span>
            <Button
              variant="primary"
              size="sm"
              icon={<Send />}
              onClick={handleSend}
              disabled={sending}
              loading={sending}
            >
              {sending ? "送信中..." : sentAt ? "再送する" : "送信する"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingSend(false)}
              disabled={sending}
            >
              キャンセル
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            icon={<Send />}
            onClick={() => setConfirmingSend(true)}
            disabled={!canSend}
          >
            {sentAt ? "再送する" : "送信する"}
          </Button>
        )
      }
    >
      {sentAt && (
        <Alert tone="warning">
          この請求書は {formatJstDateTime(sentAt)} に {sentTo} へ送信済みです。今回の操作は再送になります。
        </Alert>
      )}

      {error && <Alert tone="danger">{error}</Alert>}
      {result && <Alert tone="success">{result}</Alert>}

      <Field
        label="宛先"
        hint="既定はエントリー登録時のメールアドレスです。経理担当者など別アドレス宛の場合はここで変更してください。"
      >
        <Input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </Field>

      {ccRecipients.length > 0 && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">CC（代表者）</p>
          <p className="text-sm text-ink">{ccRecipients.join("、")}</p>
          <p className="mt-1.5 text-caption leading-5 text-ink-subtle">
            送付先にも表示されます。ユーザー管理で代表者を変更すると、ここも変わります。テスト送信では送られません。
          </p>
        </div>
      )}

      <Field label="件名">
        <Input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </Field>

      <Field
        label="本文"
        hint={`請求書PDF（${invoiceNo}）が添付されます。配信停止リンクは付きません（取引に必要な連絡のため）。`}
      >
        <Textarea
          value={bodyText}
          onChange={(e) => {
            bodyEditedRef.current = true;
            setBodyText(e.target.value);
          }}
          rows={12}
        />
      </Field>

      {/* Test send */}
      <Card padding="sm">
        <div className="space-y-2">
          <span className="block text-sm font-medium text-ink">
            テスト送信（自分宛に送って内容を確認できます）
          </span>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
              />
            </div>
            <Button
              variant="secondary"
              onClick={handleTestSend}
              disabled={testSending || !testEmail.includes("@") || !subject.trim() || !bodyText.trim()}
              loading={testSending}
            >
              {testSending ? "送信中..." : "テスト送信"}
            </Button>
          </div>
          {testError && <Alert tone="danger" compact>{testError}</Alert>}
          {testResult && <Alert tone="success" compact>{testResult}</Alert>}
        </div>
      </Card>
    </Modal>
  );
}
