"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

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

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Link href="/entries" className="text-sm text-gray-500 hover:text-gray-700">
          ← エントリー一覧に戻る
        </Link>
      </div>

      {postalAddress === "" && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg">
          フッターの住所が未設定です。
          <Link href="/settings" className="underline ml-1">
            設定画面
          </Link>
          で入力してください。
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}
      {result && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
          {result}
        </div>
      )}

      <form onSubmit={handleSend} className="space-y-4">
        {/* Segment filter */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
          <div>
            <span className="text-sm font-medium text-gray-700 block mb-2">
              年度（必須・複数選択可）
            </span>
            <div className="flex flex-wrap gap-2">
              {awards.map((award) => (
                <label
                  key={award.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-sm cursor-pointer transition-colors ${
                    selectedAwardIds.has(award.id)
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "border-gray-300 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedAwardIds.has(award.id)}
                    onChange={() => setSelectedAwardIds((s) => toggleInSet(s, award.id))}
                    className="rounded border-gray-300"
                  />
                  {award.year}年度
                </label>
              ))}
              {awards.length === 0 && (
                <span className="text-sm text-gray-400">年度（Award）が登録されていません</span>
              )}
            </div>
          </div>

          <div>
            <span className="text-sm font-medium text-gray-700 block mb-2">
              審査状況（未選択＝絞り込まない）
            </span>
            <div className="flex flex-wrap gap-2">
              {REVIEW_STATUS_OPTIONS.map((opt) => (
                <label
                  key={opt.value || "none"}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-sm cursor-pointer transition-colors ${
                    selectedReviewStatuses.has(opt.value)
                      ? "bg-green-50 border-green-300 text-green-700"
                      : "border-gray-300 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedReviewStatuses.has(opt.value)}
                    onChange={() => setSelectedReviewStatuses((s) => toggleInSet(s, opt.value))}
                    className="rounded border-gray-300"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              各項目は「ちょうどその状況」のみに完全一致します（複数選択で対象を広げられます。両方の審査を通過済みなど複数状況が併記されているエントリーはいずれの単一選択にも一致しません）。
            </p>
          </div>

          <div>
            <span className="text-sm font-medium text-gray-700 block mb-2">
              受賞枠（未選択＝絞り込まない）
            </span>
            <div className="flex flex-wrap gap-2">
              {PRIZE_LEVEL_OPTIONS.map((opt) => (
                <label
                  key={opt.value || "none"}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-sm cursor-pointer transition-colors ${
                    selectedPrizeLevels.has(opt.value)
                      ? "bg-amber-50 border-amber-300 text-amber-700"
                      : "border-gray-300 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPrizeLevels.has(opt.value)}
                    onChange={() => setSelectedPrizeLevels((s) => toggleInSet(s, opt.value))}
                    className="rounded border-gray-300"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-gray-200 flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">対象人数:</span>
            {selectedAwardIds.size === 0 ? (
              <span className="text-sm text-gray-400">年度を選択してください</span>
            ) : countLoading ? (
              <span className="text-sm text-gray-400">読み込み中...</span>
            ) : countError ? (
              <span className="text-sm text-red-600">{countError}</span>
            ) : (
              <span className="text-sm font-bold text-blue-700">{count}件</span>
            )}
            <span className="text-xs text-gray-400">
              （配信停止・重複除外前の件数目安。実送信時にさらに減る場合があります）
            </span>
          </div>

          {hasRejected && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              「選外」を含む対象への配信です。文面にご配慮ください。
            </div>
          )}
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">件名</span>
          <div className="flex gap-1 mt-1 mb-1">
            <button
              type="button"
              onClick={() => insertTag("name")}
              className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
            >
              [お名前]
            </button>
            <button
              type="button"
              onClick={() => insertTag("company")}
              className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
            >
              [会社名]
            </button>
          </div>
          <input
            ref={subjectRef}
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onFocus={() => (lastFocusedRef.current = "subject")}
            required
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">本文（改行OK・HTML可）</span>
          <div className="flex gap-1 mt-1 mb-1">
            <button
              type="button"
              onClick={() => insertTag("name")}
              className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
            >
              [お名前]
            </button>
            <button
              type="button"
              onClick={() => insertTag("company")}
              className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
            >
              [会社名]
            </button>
          </div>
          <textarea
            ref={htmlRef}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            onFocus={() => (lastFocusedRef.current = "html")}
            required
            rows={10}
            placeholder="本文を入力してください。{{name}} / {{company}} / {{email}} で宛先ごとに差し込みできます。{{name|ご担当者様}} のようにフォールバック文字列も指定できます。"
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400">
            改行はそのまま反映されます（Enterで段落を分けられます）。配信停止リンクと事務局情報は自動で本文末尾に付与されます。
          </p>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">名前が空のときの初期値</span>
          <input
            type="text"
            value={defaultName}
            onChange={(e) => setDefaultName(e.target.value)}
            className="mt-1 block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400">
            {"{{name}}"} に値がなく、フォールバック指定もない場合に使われます。
          </p>
        </label>

        {/* Preview */}
        <div className="p-3 border border-gray-200 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">プレビュー</span>
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewLoading || !subject || !html}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700
                hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {previewLoading ? "読み込み中..." : "プレビュー表示"}
            </button>
          </div>
          {previewError && <p className="text-sm text-red-600">{previewError}</p>}
          {previewData && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm text-gray-700">
                件名: {previewData.subject}
              </div>
              <iframe
                srcDoc={previewData.html}
                sandbox=""
                className="w-full h-64 bg-white"
                title="メールプレビュー"
              />
            </div>
          )}
        </div>

        {/* Test send */}
        <div className="p-3 border border-gray-200 rounded-lg space-y-2">
          <span className="text-sm font-medium text-gray-700 block">テスト送信</span>
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
              disabled={testSending || !testEmail || !subject || !html}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700
                hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {testSending ? "送信中..." : "テスト送信"}
            </button>
          </div>
          {testError && <p className="text-sm text-red-600">{testError}</p>}
          {testResult && <p className="text-sm text-green-600">{testResult}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link
            href="/entries"
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg
              hover:bg-gray-50 transition-colors"
          >
            戻る
          </Link>
          <button
            type="submit"
            disabled={sending || !canSend}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg font-medium
              hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {sending ? "送信中..." : "送信する"}
          </button>
        </div>
      </form>
    </div>
  );
}
