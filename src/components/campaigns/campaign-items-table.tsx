"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CampaignItemRow } from "@/lib/retail";
import { DECISION_LABELS, DECISIONS, RESPONSE_LABELS, RESPONSES, formatJstDateTime } from "@/lib/retail-shared";
import { PRIZE_LEVELS } from "@/lib/prize-shared";
import { Alert } from "@/components/ui/alert";
import { Badge, GrandPrixBadge, PrizeBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { BarDivider, BulkActionBar } from "@/components/ui/bulk-action-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/field-controls";
import { IconButton } from "@/components/ui/icon-button";
import { Download, Pencil, Store, TriangleAlert } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Table, Td, Th, Thumb, Tr } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { DecisionBadge, ResponseBadge } from "./badges";

type FilterKey = "all" | "yes" | "no" | "unanswered" | "pending" | "adopted" | "declined";

const FILTERS: { key: FilterKey; label: string; dot?: string; test: (r: CampaignItemRow) => boolean }[] = [
  { key: "all", label: "対象の商品", test: () => true },
  { key: "yes", label: "参加希望", dot: "bg-blue-500", test: (r) => r.response === "yes" },
  { key: "no", label: "参加しない", dot: "bg-zinc-400", test: (r) => r.response === "no" },
  { key: "unanswered", label: "未回答", test: (r) => r.response === "" },
  { key: "pending", label: "希望で未定", dot: "bg-amber-400", test: (r) => r.response === "yes" && r.decision === "" },
  { key: "adopted", label: "採用", dot: "bg-emerald-500", test: (r) => r.decision === "adopted" },
  { key: "declined", label: "見送り", dot: "bg-rose-500", test: (r) => r.decision === "declined" },
];

/** 確定のあとに企業の回答が変わった（申請ページで答え直した）か */
function changedAfterDecision(r: CampaignItemRow): boolean {
  return !!(r.decision && r.decidedAt && r.respondedAt && r.respondedAt > r.decidedAt);
}

type Patch = Partial<
  Pick<CampaignItemRow, "response" | "decision" | "respondentName" | "respondentContact" | "companyNote" | "staffMemo">
>;

export function CampaignItemsTable({
  campaignId,
  rows: initialRows,
  canManage,
  canDownload,
  yearQuery,
}: {
  campaignId: number;
  rows: CampaignItemRow[];
  canManage: boolean;
  canDownload: boolean;
  yearQuery: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [yearFilter, setYearFilter] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<CampaignItemRow | null>(null);

  const years = useMemo(() => [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a), [rows]);
  const yearRows = yearFilter ? rows.filter((r) => String(r.year) === yearFilter) : rows;
  const activeTest = FILTERS.find((f) => f.key === filter)!.test;
  const visible = yearRows.filter(activeTest);

  async function save(entryIds: number[], patch: Patch): Promise<boolean> {
    setError("");
    setSavingIds(new Set(entryIds));
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryIds, set: patch }),
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
      setSavingIds(new Set());
    }
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

  async function bulkDecide(decision: string) {
    if (await save([...selected], { decision })) setSelected(new Set());
  }

  const colCount = canManage ? 8 : 6;

  return (
    <div>
      {/* 絞り込み（件数つき）。年度の絞り込みは件数にも効く */}
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

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {years.length > 1 && (
          <Select size="sm" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="w-40" aria-label="年度で絞り込む">
            <option value="">すべての年度</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}年度
              </option>
            ))}
          </Select>
        )}
        <p className="text-caption text-ink-subtle">
          {canManage
            ? "事務局の確定は行ごとに選ぶか、チェックを付けてまとめて設定します。企業の回答を代わりに入力するときは鉛筆のボタンから"
            : "企業の回答と事務局の確定を見ることができます（変更は管理者のみ）"}
        </p>
        {canDownload && (
          <ButtonLink
            variant="secondary"
            size="sm"
            external
            className="ml-auto"
            href={`/api/campaigns/${campaignId}/export`}
            icon={<Download />}
          >
            Excelダウンロード
          </ButtonLink>
        )}
      </div>

      {error && (
        <div className="mb-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      {canManage && selected.size > 0 && (
        <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
          <span className="text-caption text-ink-subtle">事務局の確定:</span>
          {DECISIONS.map((d) => (
            <Button key={d} size="sm" variant="secondary" disabled={savingIds.size > 0} onClick={() => bulkDecide(d)}>
              {DECISION_LABELS[d]}にする
            </Button>
          ))}
          <BarDivider />
          <Button size="sm" variant="ghost" disabled={savingIds.size > 0} onClick={() => bulkDecide("")}>
            未定に戻す
          </Button>
        </BulkActionBar>
      )}

      <Table>
        <thead>
          <tr>
            {canManage && (
              <Th compact width="w-10" srLabel="選択">
                <Checkbox checked={allVisibleSelected} onChange={toggleAll} aria-label="表示中をすべて選択" />
              </Th>
            )}
            <Th width="w-16">写真</Th>
            <Th>商品</Th>
            <Th>企業の回答</Th>
            <Th>事務局の確定</Th>
            <Th>回答者・連絡事項</Th>
            <Th>回答する担当者</Th>
            {canManage && <Th width="w-12" srLabel="編集" />}
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <Tr key={r.id} selected={selected.has(r.id)}>
              {canManage && (
                <Td className="px-2">
                  <Checkbox checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`${r.productName}を選択`} />
                </Td>
              )}
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
                {canManage ? (
                  <Select
                    size="sm"
                    className="w-28"
                    value={r.decision}
                    disabled={savingIds.has(r.id)}
                    onChange={(e) => save([r.id], { decision: e.target.value })}
                    aria-label={`${r.productName}の事務局の確定`}
                  >
                    <option value="">{DECISION_LABELS[""]}</option>
                    {DECISIONS.map((d) => (
                      <option key={d} value={d}>
                        {DECISION_LABELS[d]}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <DecisionBadge decision={r.decision} />
                )}
                {changedAfterDecision(r) && (
                  <p className="mt-1 flex items-center gap-1 text-caption text-warning-ink">
                    <TriangleAlert className="size-3.5" aria-hidden="true" />
                    確定のあとに回答が変わりました
                  </p>
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
                <p className="text-ink">{r.answererName || "—"}</p>
                <p className="text-caption text-ink-subtle break-all">{r.answererEmail}</p>
                {r.contactOverridden && <Badge tone="info" size="sm" className="mt-1">案内先を変更済み</Badge>}
              </Td>
              {canManage && (
                <Td top>
                  <IconButton
                    size="sm"
                    icon={<Pencil />}
                    label={`${r.productName}の回答・確定を編集`}
                    onClick={() => setEditing(r)}
                  />
                </Td>
              )}
            </Tr>
          ))}
          {visible.length === 0 && (
            <EmptyState
              colSpan={colCount}
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

      {editing && (
        <ItemEditModal
          row={editing}
          saving={savingIds.size > 0}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            if (await save([editing.id], patch)) setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ItemEditModal({
  row,
  saving,
  onClose,
  onSave,
}: {
  row: CampaignItemRow;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: Patch) => void;
}) {
  const [v, setV] = useState({
    response: row.response,
    respondentName: row.respondentName,
    respondentContact: row.respondentContact,
    companyNote: row.companyNote,
    decision: row.decision,
    staffMemo: row.staffMemo,
  });
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [key]: e.target.value }));

  return (
    <Modal
      open
      onClose={onClose}
      title="回答・確定を編集"
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
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="企業の回答" hint="電話やメールで聞いた回答を代わりに入力できます（事務局が入力、と記録されます）">
            <Select value={v.response} onChange={set("response")}>
              <option value="">{RESPONSE_LABELS[""]}</option>
              {RESPONSES.map((r) => (
                <option key={r} value={r}>
                  {RESPONSE_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="事務局の確定">
            <Select value={v.decision} onChange={set("decision")}>
              <option value="">{DECISION_LABELS[""]}</option>
              {DECISIONS.map((d) => (
                <option key={d} value={d}>
                  {DECISION_LABELS[d]}
                </option>
              ))}
            </Select>
          </Field>
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
