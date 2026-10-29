"use client";

import { useState } from "react";
import { formatJstDateLong } from "@/lib/retail-shared";

interface Campaign {
  id: number;
  name: string;
  period: string;
  description: string;
  deadline: string | null;
  answerable: boolean;
}

interface Product {
  id: number;
  productName: string;
  companyName: string;
  year: number;
  prizeLevel: string;
  grandPrix: boolean;
  answers: { campaignId: number; response: string; companyNote: string }[];
}

const INPUT =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";
const LABEL = "block text-sm font-medium text-gray-700 mb-1";

// 公開サイトの見た目（site.css の変数）に合わせる。管理画面の色トークンは .admin-shell の中でしか効かない
export function RetailAnswerForm({
  token,
  campaigns,
  products,
  respondentName: initialName,
  respondentContact: initialContact,
  contactEmail,
}: {
  token: string;
  campaigns: Campaign[];
  products: Product[];
  respondentName: string;
  respondentContact: string;
  contactEmail: string;
}) {
  const campaignOf = new Map(campaigns.map((c) => [c.id, c]));
  const key = (campaignId: number, entryId: number) => `${campaignId}:${entryId}`;

  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(products.flatMap((p) => p.answers.map((a) => [key(a.campaignId, p.id), a.response]))),
  );
  // 連絡事項は商品ごとに1つ（企画ごとの行に同じ内容を保存する）。初期値は回答済みの行から
  const [notes, setNotes] = useState<Record<number, string>>(() =>
    Object.fromEntries(products.map((p) => [p.id, p.answers.find((a) => a.companyNote)?.companyNote ?? ""])),
  );
  const [name, setName] = useState(initialName);
  const [contact, setContact] = useState(initialContact);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const companies = [...new Set(products.map((p) => p.companyName))].join("、");
  const anyAnswerable = campaigns.some((c) => c.answerable);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    const payload = products.flatMap((p) =>
      p.answers
        .filter((a) => campaignOf.get(a.campaignId)?.answerable && answers[key(a.campaignId, p.id)])
        .map((a) => ({ campaignId: a.campaignId, entryId: p.id, response: answers[key(a.campaignId, p.id)] })),
    );
    if (payload.length === 0) {
      setError("「参加を希望する」か「参加しない」を、1つ以上選んでください");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/retail/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respondentName: name, respondentContact: contact, answers: payload, notes }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "送信できませんでした");
        return;
      }
      setDone(`回答を受け付けました（${payload.length}件）。締切までは、このページから何度でも変更できます。`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("通信エラーで送信できませんでした。時間をおいてもう一度お試しください");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      {done && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
          {done}
        </div>
      )}

      <p className="text-sm text-gray-700">
        <span className="font-bold">{companies}</span> 様 ／ ご回答いただく受賞商品は {products.length}品 です。
      </p>

      {/* 企画の説明 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-bold text-gray-900">募集中の企画</h2>
        <ul className="space-y-4">
          {campaigns.map((c) => (
            <li key={c.id} className="border-t border-gray-100 pt-4 first:border-0 first:pt-0">
              <p className="flex flex-wrap items-center gap-2 font-bold text-gray-900">
                {c.name}
                {!c.answerable && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">受付終了</span>
                )}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {c.period && <>実施時期: {c.period}　</>}
                {c.deadline && <>回答締切: {formatJstDateLong(c.deadline)}</>}
              </p>
              {c.description && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{c.description}</p>}
            </li>
          ))}
        </ul>
      </div>

      {/* 商品ごとの回答 */}
      {products.map((p) => (
        <fieldset key={p.id} className="rounded-xl border border-gray-200 bg-white p-6">
          <legend className="sr-only">{p.productName}</legend>
          <p className="text-base font-bold text-gray-900">{p.productName}</p>
          <p className="mb-4 text-sm text-gray-600">
            {p.year}年度 {p.prizeLevel}
            {p.grandPrix && "・グランプリ"}
          </p>
          <div className="divide-y divide-gray-100">
            {p.answers.map((a) => {
              const c = campaignOf.get(a.campaignId)!;
              const k = key(a.campaignId, p.id);
              const groupName = `r-${k}`;
              return (
                <div key={k} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`${p.productName}：${c.name}`}>
                    {[
                      { value: "yes", label: "参加を希望する", on: "border-blue-600 bg-blue-50 text-blue-800" },
                      { value: "no", label: "参加しない", on: "border-gray-500 bg-gray-100 text-gray-800" },
                    ].map((opt) => {
                      const checked = answers[k] === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                            checked ? opt.on : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          } ${!c.answerable ? "cursor-not-allowed opacity-60" : ""}`}
                        >
                          <input
                            type="radio"
                            name={groupName}
                            value={opt.value}
                            checked={checked}
                            disabled={!c.answerable}
                            onChange={() => setAnswers((prev) => ({ ...prev, [k]: opt.value }))}
                          />
                          {opt.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <label className="mt-3 block">
            <span className={LABEL}>
              この商品についての連絡事項 <span className="font-normal text-gray-500">（任意）</span>
            </span>
            <textarea
              rows={2}
              maxLength={1000}
              className={`${INPUT} resize-y`}
              value={notes[p.id] ?? ""}
              onChange={(e) => setNotes((prev) => ({ ...prev, [p.id]: e.target.value }))}
              placeholder="例: 出荷できる数量、温度帯、ご希望の時期など"
            />
          </label>
        </fieldset>
      ))}

      {/* 回答者 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-1 text-base font-bold text-gray-900">ご回答者</h2>
        <p className="mb-4 text-xs text-gray-500">企画の調整でご連絡する際の窓口として控えます。</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL}>
              お名前 <span className="text-red-500">*</span>
            </span>
            <input required maxLength={100} className={INPUT} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className={LABEL}>
              電話番号 <span className="text-red-500">*</span>
            </span>
            <input
              required
              type="tel"
              maxLength={100}
              className={INPUT}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {anyAnswerable ? (
        <button
          type="submit"
          disabled={sending}
          className="w-full rounded-xl bg-blue-600 py-4 text-lg font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {sending ? "送信しています..." : "回答を送信する"}
        </button>
      ) : (
        <p className="text-center text-sm text-gray-600">すべての企画の受付が終了しました。</p>
      )}
      <p className="text-center text-xs text-gray-500">
        ご不明な点は <a href={`mailto:${contactEmail}`}>{contactEmail}</a> までお問い合わせください。
      </p>
    </form>
  );
}
