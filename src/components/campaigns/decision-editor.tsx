"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CampaignItemRow } from "@/lib/retail";
import { DECISION_LABELS, RESPONSE_LABELS, RESPONSES, formatJstDateTime } from "@/lib/retail-shared";
import { PRIZE_LEVELS } from "@/lib/prize-shared";
import { Alert } from "@/components/ui/alert";
import { Badge, GrandPrixBadge, PrizeBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarDivider, BulkActionBar } from "@/components/ui/bulk-action-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/field-controls";
import { IconButton } from "@/components/ui/icon-button";
import { MessageSquare, Store, TriangleAlert } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { Table, Td, Th, Thumb, Tr } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { DecisionBadge, ResponseBadge } from "./badges";

type FilterKey = "all" | "pending" | "adopted" | "declined" | "yes" | "no" | "unanswered";

// 絞り込みは保存済みの値で数える（選び直した行が絞り込みから消えないように）
const FILTERS: { key: FilterKey; label: string; dot?: string; test: (r: CampaignItemRow) => boolean }[] = [
  { key: "all", label: "対象の商品", test: () => true },
  { key: "pending", label: "確定待ち", dot: "bg-amber-400", test: (r) => r.response === "yes" && r.decision === "" },
  { key: "adopted", label: "採用", dot: "bg-emerald-500", test: (r) => r.decision === "adopted" },
  { key: "declined", label: "見送り", dot: "bg-rose-500", test: (r) => r.decision === "declined" },
  { key: "yes", label: "参加希望", dot: "bg-blue-500", test: (r) => r.response === "yes" },
  { key: "no", label: "参加しない", dot: "bg-zinc-400", test: (r) => r.response === "no" },
  { key: "unanswered", label: "未回答", test: (r) => r.response === "" },
];

// 選んでいる値がひと目で分かるよう、採用は緑・見送りは赤で塗る（未定は枠だけ）
const DECISION_OPTIONS = [
  { value: "", label: "未定", on: "bg-surface text-ink font-medium shadow-xs ring-1 ring-line-strong" },
  { value: "adopted", label: "採用", on: "bg-emerald-600 text-white font-medium shadow-xs" },
  { value: "declined", label: "見送り", on: "bg-rose-600 text-white font-medium shadow-xs" },
] as const;
type Decision = (typeof DECISION_OPTIONS)[number]["value"];

function DecisionPicker({ value, onChange, label }: { value: Decision; onChange: (v: Decision) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-0.5 rounded-md bg-surface-muted p-0.5">
      {DECISION_OPTIONS.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-8 whitespace-nowrap rounded-[5px] px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
              selected ? opt.on : "text-ink-muted hover:bg-surface hover:text-ink",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** 確定のあとに企業の回答が変わった（申請ページで答え直した）か */
function changedAfterDecision(r: CampaignItemRow): boolean {
  return !!(r.decision && r.decidedAt && r.respondedAt && r.respondedAt > r.decidedAt);
}

type AnswerPatch = Partial<
  Pick<CampaignItemRow, "response" | "respondentName" | "respondentContact" | "companyNote" | "staffMemo">
>;

const LEAVE_MESSAGE = "保存していない変更があります。変更を破棄して移動しますか？";

/**
 * 採用・見送りの編集（管理者のみ）。選んだ内容は下書きとして持ち、「保存する」→ 確認 → 保存 のときだけ反映する。
 * 企業の回答の代理入力（鉛筆のボタン）は別の操作で、モーダルの「保存する」で1件ずつ保存する
 */
export function DecisionEditor({
  campaignId,
  campaignName,
  rows: initialRows,
  yearQuery,
}: {
  campaignId: number;
  campaignName: string;
  rows: CampaignItemRow[];
  yearQuery: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  // 商品 id → 選び直した値（保存済みと同じ値に戻したら消す）
  const [draft, setDraft] = useState<Map<number, Decision>>(new Map());
  const [filter, setFilter] = useState<FilterKey>("all");
  const [yearFilter, setYearFilter] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<CampaignItemRow | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const years = useMemo(() => [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a), [rows]);
  const yearRows = yearFilter ? rows.filter((r) => String(r.year) === yearFilter) : rows;
  const visible = yearRows.filter(FILTERS.find((f) => f.key === filter)!.test);
  const changes = rows.filter((r) => draft.has(r.id)).map((r) => ({ row: r, to: draft.get(r.id)! }));
  const dirty = changes.length > 0;

  // 保存していない変更があるとき、ページを閉じる・別の画面へ移る前に確かめる
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    // next/link の移動は beforeunload が出ないので、リンクのクリックを先に受けて確かめる
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!a || a.getAttribute("target") === "_blank" || e.defaultPrevented) return;
      if (!window.confirm(LEAVE_MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  function decide(ids: number[], value: Decision) {
    setDraft((prev) => {
      const next = new Map(prev);
      for (const id of ids) {
        const saved = rows.find((r) => r.id === id)?.decision ?? "";
        if (value === saved) next.delete(id);
        else next.set(id, value);
      }
      return next;
    });
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  function toggleAll() {
    setSelected(allVisibleSelected ? new Set() : new Set(visible.map((r) => r.id)));
  }

  async function saveDecisions() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions: changes.map((c) => ({ entryId: c.row.id, decision: c.to })) }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "保存に失敗しました");
        setConfirming(false);
        return;
      }
      // 移動の確認を出さないよう、下書きを空にしてから企画のページへ戻る
      setDraft(new Map());
      const sp = new URLSearchParams(yearQuery.replace(/^\?/, ""));
      sp.set("saved", String(data.count ?? changes.length));
      router.push(`/campaigns/${campaignId}?${sp.toString()}`);
      router.refresh();
    } catch (e) {
      setError("通信エラー: " + (e instanceof Error ? e.message : String(e)));
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  // 企業の回答の代理入力（1件ずつ、すぐ保存）
  async function saveAnswer(entryId: number, patch: AnswerPatch): Promise<boolean> {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryIds: [entryId], set: patch }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "保存に失敗しました");
        return false;
      }
      const updated = new Map<number, Partial<CampaignItemRow>>(
        (data.items as (Partial<CampaignItemRow> & { entryId: number })[]).map((i) => [i.entryId, i]),
      );
      setRows((prev) => prev.map((r) => (updated.has(r.id) ? { ...r, ...updated.get(r.id) } : r)));
      return true;
    } catch (e) {
      setError("通信エラー: " + (e instanceof Error ? e.message : String(e)));
      return false;
    } finally {
      setSaving(false);
    }
  }

  const tally = (value: Decision) => changes.filter((c) => c.to === value).length;
  const summary = [
    tally("adopted") && `採用 ${tally("adopted")}`,
    tally("declined") && `見送り ${tally("declined")}`,
    tally("") && `未定に戻す ${tally("")}`,
  ]
    .filter(Boolean)
    .join("・");

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex h-14 items-center justify-between gap-2 rounded-lg border bg-surface px-3 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                active
                  ? "border-ink text-ink ring-1 ring-ink"
                  : "border-line text-ink-muted hover:border-line-strong hover:bg-surface-muted/40",
              )}
            >
              <span className="flex items-center gap-1.5 text-sm">
                {f.dot && <span aria-hidden="true" className={cn("size-2 rounded-full", f.dot)} />}
                {f.label}
              </span>
              <span className="text-lg font-semibold tabular-nums">{yearRows.filter(f.test).length}</span>
            </button>
          );
        })}
      </div>

      {years.length > 1 && (
        <div className="mb-3">
          <Select size="sm" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="w-40" aria-label="年度で絞り込む">
            <option value="">すべての年度</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}年度
              </option>
            ))}
          </Select>
        </div>
      )}

      {error && (
        <div className="mb-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      {selected.size > 0 && (
        <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
          <span className="text-caption text-ink-subtle">チェックした商品を:</span>
          <Button size="sm" variant="secondary" onClick={() => (decide([...selected], "adopted"), setSelected(new Set()))}>
            採用にする
          </Button>
          <Button size="sm" variant="secondary" onClick={() => (decide([...selected], "declined"), setSelected(new Set()))}>
            見送りにする
          </Button>
          <BarDivider />
          <Button size="sm" variant="ghost" onClick={() => (decide([...selected], ""), setSelected(new Set()))}>
            未定に戻す
          </Button>
        </BulkActionBar>
      )}

      <Table>
        <thead>
          <tr>
            <Th compact width="w-10" srLabel="選択">
              <Checkbox checked={allVisibleSelected} onChange={toggleAll} aria-label="表示中をすべて選択" />
            </Th>
            <Th width="w-16">写真</Th>
            <Th>商品</Th>
            <Th>企業の回答</Th>
            <Th>事務局の確定</Th>
            <Th>回答者・連絡事項</Th>
            <Th width="w-12" srLabel="企業の回答を代わりに入力" />
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => {
            const value = draft.get(r.id) ?? (r.decision as Decision);
            const changed = draft.has(r.id);
            return (
              <Tr
                key={r.id}
                selected={selected.has(r.id)}
                className={cn(changed && !selected.has(r.id) && "[&>td]:bg-amber-50")}
              >
                <Td className="px-2">
                  <Checkbox checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`${r.productName}を選択`} />
                </Td>
                <Td>
                  <Thumb src={r.mainImageId ? `/api/images/${r.mainImageId}` : undefined} alt="" />
                </Td>
                <Td top>
                  <Link
                    href={`/entries/${r.id}${yearQuery}`}
                    className="font-medium text-ink hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    {r.productName}
                  </Link>
                  <p className="text-caption text-ink-subtle">{r.companyName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Badge tone="neutral" size="sm">{r.year}年度</Badge>
                    {(PRIZE_LEVELS as readonly string[]).includes(r.prizeLevel) ? (
                      <PrizeBadge prizeLevel={r.prizeLevel} size="sm" />
                    ) : (
                      r.prizeLevel && <Badge tone="neutral" size="sm">{r.prizeLevel}</Badge>
                    )}
                    {r.grandPrix && <GrandPrixBadge size="sm" />}
                    {r.outOfScope && <Badge tone="warning" size="sm">対象年度の外</Badge>}
                  </div>
                </Td>
                <Td top>
                  <ResponseBadge response={r.response} />
                  {r.respondedAt && (
                    <p className="mt-1 text-caption text-ink-subtle tabular-nums">
                      {formatJstDateTime(r.respondedAt)}
                      {r.respondedVia === "staff" && "（事務局が入力）"}
                    </p>
                  )}
                </Td>
                <Td top>
                  <DecisionPicker value={value} onChange={(v) => decide([r.id], v)} label={`${r.productName}の事務局の確定`} />
                  {changed ? (
                    <p className="mt-1 text-caption font-medium text-warning-ink">
                      未保存（保存済み: {DECISION_LABELS[r.decision as Decision]}）
                    </p>
                  ) : (
                    changedAfterDecision(r) && (
                      <p className="mt-1 flex items-center gap-1 text-caption text-warning-ink">
                        <TriangleAlert className="size-3.5" aria-hidden="true" />
                        確定のあとに回答が変わりました
                      </p>
                    )
                  )}
                </Td>
                <Td top className="max-w-xs">
                  {r.respondentName || r.respondentContact ? (
                    <>
                      <p className="text-ink">{r.respondentName}</p>
                      {r.respondentContact && (
                        <p className="whitespace-nowrap text-caption text-ink-subtle tabular-nums">{r.respondentContact}</p>
                      )}
                    </>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                  {r.companyNote && <p className="mt-0.5 whitespace-pre-wrap text-caption">{r.companyNote}</p>}
                  {r.staffMemo && (
                    <p className="mt-0.5 whitespace-pre-wrap text-caption text-ink-subtle">メモ: {r.staffMemo}</p>
                  )}
                </Td>
                <Td top>
                  <IconButton
                    size="sm"
                    icon={<MessageSquare />}
                    label={`${r.productName}：企業の回答を代わりに入力`}
                    onClick={() => setEditing(r)}
                  />
                </Td>
              </Tr>
            );
          })}
          {visible.length === 0 && (
            <EmptyState
              colSpan={7}
              icon={Store}
              title={rows.length === 0 ? "対象の受賞商品がありません" : "該当する商品はありません"}
              description={
                rows.length === 0
                  ? "対象年度に受賞商品が無いか、まだ受賞が設定されていません"
                  : "上の絞り込みを「対象の商品」に戻すと、すべて表示します"
              }
            />
          )}
        </tbody>
      </Table>

      <StickyActionBar
        start={
          <p className={cn("text-sm", dirty ? "font-medium text-warning-ink" : "text-ink-subtle")}>
            {dirty ? `保存していない変更 ${changes.length}件（${summary}）` : "変更はまだありません"}
          </p>
        }
      >
        <Button variant="secondary" disabled={!dirty || saving} onClick={() => setDraft(new Map())}>
          変更を取り消す
        </Button>
        <Button variant="primary" disabled={!dirty || saving} onClick={() => setConfirming(true)}>
          保存する
        </Button>
      </StickyActionBar>

      {confirming && (
        <Modal
          open
          onClose={() => !saving && setConfirming(false)}
          title="この内容で保存しますか？"
          description={`${campaignName}：${changes.length}件の変更`}
          size="lg"
          footer={
            <>
              <Button variant="secondary" disabled={saving} onClick={() => setConfirming(false)}>
                戻って直す
              </Button>
              <Button variant="primary" loading={saving} disabled={saving} onClick={saveDecisions}>
                {changes.length}件を保存する
              </Button>
            </>
          }
        >
          <ul className="divide-y divide-line rounded-lg border border-line">
            {changes.map(({ row, to }) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="font-medium text-ink">{row.productName}</span>
                  <span className="ml-2 text-caption text-ink-subtle">{row.companyName}</span>
                </span>
                <span className="flex items-center gap-1.5 text-caption text-ink-subtle">
                  <DecisionBadge decision={row.decision} size="sm" />→<DecisionBadge decision={to} size="sm" />
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-caption text-ink-subtle">
            保存すると、流通企画の参加状況と企画のページにすぐ反映されます。企業の申請ページには、事務局の採用・見送りは表示されません。
          </p>
        </Modal>
      )}

      {editing && (
        <AnswerModal
          row={editing}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            if (await saveAnswer(editing.id, patch)) setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function AnswerModal({
  row,
  saving,
  onClose,
  onSave,
}: {
  row: CampaignItemRow;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: AnswerPatch) => void;
}) {
  const [v, setV] = useState({
    response: row.response,
    respondentName: row.respondentName,
    respondentContact: row.respondentContact,
    companyNote: row.companyNote,
    staffMemo: row.staffMemo,
  });
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [key]: e.target.value }));

  return (
    <Modal
      open
      onClose={onClose}
      title="企業の回答を代わりに入力"
      description={`${row.productName}（${row.companyName}）`}
      size="lg"
      as="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v);
      }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={saving}>
            保存する
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Alert tone="info" compact>
          電話やメールで聞いた回答を入力します（「事務局が入力」と記録されます）。この画面の「保存する」で、すぐに保存されます。採用・見送りは表の中で選んでください。
        </Alert>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="企業の回答">
            <Select value={v.response} onChange={set("response")}>
              <option value="">{RESPONSE_LABELS[""]}</option>
              {RESPONSES.map((r) => (
                <option key={r} value={r}>
                  {RESPONSE_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="hidden md:block" />
          <Field label="回答者" labelHint="任意">
            <Input maxLength={100} value={v.respondentName} onChange={set("respondentName")} />
          </Field>
          <Field label="回答者の連絡先" labelHint="任意">
            <Input maxLength={100} value={v.respondentContact} onChange={set("respondentContact")} />
          </Field>
        </div>
        <Field label="企業からの連絡事項" labelHint="任意">
          <Textarea rows={3} maxLength={1000} value={v.companyNote} onChange={set("companyNote")} />
        </Field>
        <Field label="事務局メモ" labelHint="任意・企業には出ません">
          <Textarea rows={3} maxLength={1000} value={v.staffMemo} onChange={set("staffMemo")} />
        </Field>
        {row.respondedVia === "form" && v.response !== row.response && (
          <Alert tone="warning" compact>
            企業が申請ページから答えた回答を書き換えます。企業がもう一度申請ページから送ると、そちらで上書きされます
          </Alert>
        )}
      </div>
    </Modal>
  );
}
