"use client";

import { useState, useEffect, useRef, useId } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { CheckPill } from "@/components/ui/check-pill";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/field-controls";
import { Send } from "@/components/ui/icons";

interface Award {
  id: number;
  year: number;
  name: string;
}

const REVIEW_STATUS_OPTIONS = [
  { value: "", label: "未審査" },
  { value: "first_passed", label: "1次審査通過" },
  { value: "second_passed", label: "2次審査通過" },
  { value: "rejected", label: "選外" },
];

const PRIZE_LEVEL_OPTIONS = [
  { value: "", label: "受賞なし" },
  { value: "銅賞", label: "銅賞" },
  { value: "銀賞", label: "銀賞" },
  { value: "金賞", label: "金賞" },
  { value: "最高金賞", label: "最高金賞" },
];

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function EntryEmailComposer({ awards }: { awards: Award[] }) {
  const [selectedAwardIds, setSelectedAwardIds] = useState<Set<number>>(new Set());
  const [selectedReviewStatuses, setSelectedReviewStatuses] = useState<Set<string>>(new Set());
  const [selectedPrizeLevels, setSelectedPrizeLevels] = useState<Set<string>>(new Set());

  const [count, setCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [countError, setCountError] = useState("");

  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [defaultName, setDefaultName] = useState("ご担当者様");
  const [postalAddress, setPostalAddress] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{ subject: string; html: string } | null>(null);
  const [previewError, setPreviewError] = useState("");

  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [testError, setTestError] = useState("");

  const subjectRef = useRef<HTMLInputElement>(null);
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const lastFocusedRef = useRef<"subject" | "html">("html");

  // 差し込みタグのボタンを label の中に置かないため、ラベルと入力欄は id で結ぶ
  const subjectId = useId();
  const htmlId = useId();

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPostalAddress(data.settings.postalAddress || "");
      });
  }, []);

  // Live audience-size preview, debounced while the admin toggles filter checkboxes.
  useEffect(() => {
    if (selectedAwardIds.size === 0) {
      setCount(null);
      setCountError("");
      return;
    }
    setCountLoading(true);
    setCountError("");
    const timer = setTimeout(() => {
      fetch("/api/entries/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countOnly: true,
          awardIds: Array.from(selectedAwardIds),
          reviewStatuses: Array.from(selectedReviewStatuses),
          prizeLevels: Array.from(selectedPrizeLevels),
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setCount(data.count);
          else setCountError(data.message || "対象人数の取得に失敗しました");
        })
        .catch(() => setCountError("対象人数の取得に失敗しました"))
        .finally(() => setCountLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedAwardIds, selectedReviewStatuses, selectedPrizeLevels]);

  const hasRejected = selectedReviewStatuses.has("rejected");
  const canSend = selectedAwardIds.size > 0 && !!count && count > 0;

  function insertTag(tag: string) {
    const placeholder = `{{${tag}}}`;
    if (lastFocusedRef.current === "subject") {
      const el = subjectRef.current;
      const pos = el?.selectionStart ?? subject.length;
      const next = subject.slice(0, pos) + placeholder + subject.slice(pos);
      setSubject(next);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(pos + placeholder.length, pos + placeholder.length);
      });
    } else {
      const el = htmlRef.current;
      const pos = el?.selectionStart ?? html.length;
      const next = html.slice(0, pos) + placeholder + html.slice(pos);
      setHtml(next);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(pos + placeholder.length, pos + placeholder.length);
      });
    }
  }

  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewError("");
    setPreviewData(null);
    try {
      const res = await fetch("/api/entries/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, html, defaultName, preview: true }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewData(data.preview);
      } else {
        setPreviewError(data.message);
      }
    } catch {
      setPreviewError("プレビューの取得に失敗しました");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleTestSend() {
    setTestSending(true);
    setTestError("");
    setTestResult("");
    try {
      const res = await fetch("/api/entries/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, html, defaultName, testEmail }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult(data.message);
      } else {
        setTestError(data.message);
      }
    } catch {
      setTestError("テスト送信に失敗しました");
    } finally {
      setTestSending(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;

    const conditionLabel = [
      `年度: ${awards
        .filter((a) => selectedAwardIds.has(a.id))
        .map((a) => `${a.year}年度`)
        .join("・")}`,
      selectedReviewStatuses.size > 0
        ? `審査状況: ${REVIEW_STATUS_OPTIONS.filter((o) => selectedReviewStatuses.has(o.value))
            .map((o) => o.label)
            .join("・")}`
        : null,
      selectedPrizeLevels.size > 0
        ? `受賞枠: ${PRIZE_LEVEL_OPTIONS.filter((o) => selectedPrizeLevels.has(o.value))
            .map((o) => o.label)
            .join("・")}`
        : null,
    ]
      .filter(Boolean)
      .join(" / ");

    if (
      !window.confirm(
        `対象 ${count}件 に送信します。\n条件: ${conditionLabel}\n\nよろしいですか？`
      )
    )
      return;

    setSending(true);
    setError("");
    setResult("");

    try {
      const res = await fetch("/api/entries/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awardIds: Array.from(selectedAwardIds),
          reviewStatuses: Array.from(selectedReviewStatuses),
          prizeLevels: Array.from(selectedPrizeLevels),
          subject,
          html,
          defaultName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.message);
      } else {
        setError(data.message);
      }
    } catch {
      setError("送信に失敗しました");
    } finally {
      setSending(false);
    }
  }

  const tagButtons = (
    <div className="mb-1.5 flex gap-1.5">
      <Button variant="secondary" size="sm" onClick={() => insertTag("name")}>
        [お名前]
      </Button>
      <Button variant="secondary" size="sm" onClick={() => insertTag("company")}>
        [会社名]
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      {postalAddress === "" && (
        <Alert tone="warning">
          フッターの住所が未設定です。
          <Link href="/settings" className="ml-1 font-medium underline">
            設定画面
          </Link>
          で入力してください。
        </Alert>
      )}

      {error && <Alert tone="danger">{error}</Alert>}
      {result && <Alert tone="success">{result}</Alert>}

      <form onSubmit={handleSend} className="space-y-5">
        {/* Segment filter */}
        <Card>
          <div className="space-y-5">
            {/* CheckPill は label 要素なので Field（label で包む）ではなく FieldLabel */}
            <div>
              <FieldLabel>年度（必須・複数選択可）</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {awards.map((award) => (
                  <CheckPill
                    key={award.id}
                    checked={selectedAwardIds.has(award.id)}
                    onChange={() => setSelectedAwardIds((s) => toggleInSet(s, award.id))}
                  >
                    {award.year}年度
                  </CheckPill>
                ))}
                {awards.length === 0 && (
                  <span className="text-sm text-ink-subtle">年度（Award）が登録されていません</span>
                )}
              </div>
            </div>

            <div>
              <FieldLabel>審査状況（未選択＝絞り込まない）</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {REVIEW_STATUS_OPTIONS.map((opt) => (
                  <CheckPill
                    key={opt.value || "none"}
                    checked={selectedReviewStatuses.has(opt.value)}
                    onChange={() => setSelectedReviewStatuses((s) => toggleInSet(s, opt.value))}
                  >
                    {opt.label}
                  </CheckPill>
                ))}
              </div>
              <p className="mt-1.5 text-caption leading-5 text-ink-subtle">
                各項目は「ちょうどその状況」のみに完全一致します（複数選択で対象を広げられます。両方の審査を通過済みなど複数状況が併記されているエントリーはいずれの単一選択にも一致しません）。
              </p>
            </div>

            <div>
              <FieldLabel>受賞枠（未選択＝絞り込まない）</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {PRIZE_LEVEL_OPTIONS.map((opt) => (
                  <CheckPill
                    key={opt.value || "none"}
                    checked={selectedPrizeLevels.has(opt.value)}
                    onChange={() => setSelectedPrizeLevels((s) => toggleInSet(s, opt.value))}
                  >
                    {opt.label}
                  </CheckPill>
                ))}
              </div>
            </div>

            <div className="border-t border-line pt-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-ink">対象人数:</span>
                {selectedAwardIds.size === 0 ? (
                  <span className="text-ink-subtle">年度を選択してください</span>
                ) : countLoading ? (
                  <span className="text-ink-subtle">読み込み中...</span>
                ) : countError ? (
                  <span className="text-danger">{countError}</span>
                ) : (
                  <span className="font-semibold tabular-nums text-accent">{count}件</span>
                )}
              </div>
              <div className="mt-2">
                <Alert tone="info" compact>
                  （配信停止・重複除外前の件数目安。実送信時にさらに減る場合があります）
                </Alert>
              </div>
            </div>

            {hasRejected && (
              <Alert tone="danger" compact>
                「選外」を含む対象への配信です。文面にご配慮ください。
              </Alert>
            )}
          </div>
        </Card>

        <Field label="件名" htmlFor={subjectId}>
          {tagButtons}
          <Input
            id={subjectId}
            ref={subjectRef}
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onFocus={() => (lastFocusedRef.current = "subject")}
            required
          />
        </Field>

        <Field label="本文（改行OK・HTML可）" htmlFor={htmlId}>
          {tagButtons}
          <Textarea
            id={htmlId}
            ref={htmlRef}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            onFocus={() => (lastFocusedRef.current = "html")}
            required
            rows={10}
            placeholder="本文を入力してください。{{name}} / {{company}} / {{email}} で宛先ごとに差し込みできます。{{name|ご担当者様}} のようにフォールバック文字列も指定できます。"
          />
          <div className="mt-2">
            <Alert tone="info">
              改行はそのまま反映されます（Enterで段落を分けられます）。配信停止リンクと事務局情報は自動で本文末尾に付与されます。
            </Alert>
          </div>
        </Field>

        <Field
          label="名前が空のときの初期値"
          hint={<>{"{{name}}"} に値がなく、フォールバック指定もない場合に使われます。</>}
        >
          <div className="max-w-xs">
            <Input
              type="text"
              value={defaultName}
              onChange={(e) => setDefaultName(e.target.value)}
            />
          </div>
        </Field>

        {/* Preview */}
        <Card padding="sm">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>プレビュー</CardTitle>
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePreview}
              disabled={previewLoading || !subject || !html}
              loading={previewLoading}
            >
              {previewLoading ? "読み込み中..." : "プレビュー表示"}
            </Button>
          </div>
          {previewError && (
            <div className="mt-3">
              <Alert tone="danger">{previewError}</Alert>
            </div>
          )}
          {previewData && (
            <div className="mt-3 overflow-hidden rounded-md border border-line">
              <div className="border-b border-line bg-surface-muted/60 px-3 py-2 text-sm text-ink">
                件名: {previewData.subject}
              </div>
              <iframe
                srcDoc={previewData.html}
                sandbox=""
                className="h-64 w-full bg-surface"
                title="メールプレビュー"
              />
            </div>
          )}
        </Card>

        {/* Test send */}
        <Card padding="sm">
          <CardTitle>テスト送信</CardTitle>
          <div className="mt-3 flex gap-2">
            <div className="flex-1">
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
              disabled={testSending || !testEmail || !subject || !html}
              loading={testSending}
            >
              {testSending ? "送信中..." : "テスト送信"}
            </Button>
          </div>
          {testError && (
            <div className="mt-3">
              <Alert tone="danger">{testError}</Alert>
            </div>
          )}
          {testResult && (
            <div className="mt-3">
              <Alert tone="success">{testResult}</Alert>
            </div>
          )}
        </Card>

        <div className="flex justify-end gap-2 pt-2">
          <ButtonLink variant="secondary" href="/entries">
            戻る
          </ButtonLink>
          <Button
            variant="primary"
            type="submit"
            disabled={sending || !canSend}
            loading={sending}
            icon={<Send />}
          >
            {sending ? "送信中..." : "送信する"}
          </Button>
        </div>
      </form>
    </div>
  );
}
