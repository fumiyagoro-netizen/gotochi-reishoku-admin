"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PrizeBadge } from "./prize-selector";
import { ReviewBadge } from "./review-status-selector";
import { ItemArrivalBadge } from "./item-arrival-selector";
import { ITEM_ARRIVAL_STATUSES } from "@/lib/item-arrival-shared";
import { PRIZE_LEVELS, PRIZE_DOT_CLASS } from "@/lib/prize-shared";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/cn";
import { Table, Th, Td, Tr, Thumb } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field-controls";
import { EmptyState } from "@/components/ui/empty-state";
import { BulkActionBar, BarDivider } from "@/components/ui/bulk-action-bar";
import {
  ClipboardCheck,
  ClipboardList,
  Minus,
  Package,
  Plus,
  Trophy,
} from "@/components/ui/icons";

interface EntryRow {
  id: number;
  productName: string;
  companyName: string;
  productCategory: string;
  prefecture: string;
  contactLastName: string;
  contactFirstName: string;
  answeredAt: string;
  prizeLevel: string;
  reviewStatus: string;
  itemArrivalStatus: string;
  images: { id: number; imageUrl: string }[];
}

// 一括設定では「選外」を付けない仕様のため、review-status-shared.ts の配列とは統合しない
const REVIEW_STATUSES = [
  { value: "first_passed", label: "1次審査通過" },
  { value: "second_passed", label: "2次審査通過" },
];

// 表内リンク。Td primary の font-medium を引き継ぎ、色だけアクセントにする
const LINK_CLASS =
  "text-accent hover:underline rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

export function EntryTable({
  entries,
  year,
  filtered = false,
}: {
  entries: EntryRow[];
  year: number | null;
  /** 検索・カテゴリで絞り込み中か（空状態の説明文を「未登録」と「該当なし」で分けるためだけに使う） */
  filtered?: boolean;
}) {
  const { permissions } = useRole();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"" | "prize" | "review" | "arrival">("");
  const [applying, setApplying] = useState(false);
  const router = useRouter();
  // Both flags gate the checkbox column / bulk bar: editor has
  // canSetItemArrival but not canSetPrize (see src/lib/role-shared.ts), and
  // still needs to bulk-toggle item arrival, so the row/column visibility
  // can't be keyed on canSetPrize alone anymore. Each individual bulk
  // action button below stays gated on its own specific flag.
  const canBulkSelect = permissions.canSetPrize || permissions.canSetItemArrival;

  // 空状態の colSpan は列構成（チェック列・担当者列の有無）に連動させる
  const colCount = 7 + (canBulkSelect ? 1 : 0) + (permissions.canSeePrivateInfo ? 1 : 0);

  function toggleAll() {
    if (selected.size === entries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(entries.map((e) => e.id)));
    }
  }

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function applyPrize(prizeLevel: string) {
    setApplying(true);
    try {
      const res = await fetch("/api/entries/bulk-prize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryIds: Array.from(selected), prizeLevel }),
      });
      const data = await res.json();
      if (data.success) {
        setSelected(new Set());
        setBulkAction("");
        router.refresh();
      } else {
        alert(data.message);
      }
    } catch {
      alert("一括設定に失敗しました");
    } finally {
      setApplying(false);
    }
  }

  async function applyReview(reviewStatus: string, action: "add" | "remove" | "clear") {
    setApplying(true);
    try {
      const res = await fetch("/api/entries/bulk-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryIds: Array.from(selected), reviewStatus, action }),
      });
      const data = await res.json();
      if (data.success) {
        setSelected(new Set());
        setBulkAction("");
        router.refresh();
      } else {
        alert(data.message);
      }
    } catch {
      alert("一括設定に失敗しました");
    } finally {
      setApplying(false);
    }
  }

  async function applyArrival(itemArrivalStatus: string, action: "add" | "remove" | "clear") {
    setApplying(true);
    try {
      const res = await fetch("/api/entries/bulk-item-arrival", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryIds: Array.from(selected), itemArrivalStatus, action }),
      });
      const data = await res.json();
      if (data.success) {
        setSelected(new Set());
        setBulkAction("");
        router.refresh();
      } else {
        alert(data.message);
      }
    } catch {
      alert("一括設定に失敗しました");
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      {/* Bulk Action Bar */}
      {canBulkSelect && selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          onClear={() => { setSelected(new Set()); setBulkAction(""); }}
        >
          {bulkAction === "" && (
            <>
              {permissions.canSetPrize && (
                <Button size="sm" icon={<Trophy />} onClick={() => setBulkAction("prize")}>
                  受賞を一括設定
                </Button>
              )}
              {permissions.canSetPrize && (
                <Button size="sm" icon={<ClipboardCheck />} onClick={() => setBulkAction("review")}>
                  審査状況を一括設定
                </Button>
              )}
              {permissions.canSetItemArrival && (
                <Button size="sm" icon={<Package />} onClick={() => setBulkAction("arrival")}>
                  商品到着を一括設定
                </Button>
              )}
            </>
          )}
          {bulkAction === "prize" && (
            <>
              {PRIZE_LEVELS.map((level) => (
                <Button
                  key={level}
                  size="sm"
                  icon={<span aria-hidden="true" className={cn("size-2 rounded-full", PRIZE_DOT_CLASS[level])} />}
                  onClick={() => applyPrize(level)}
                  disabled={applying}
                >
                  {level}
                </Button>
              ))}
              <Button size="sm" variant="dangerGhost" onClick={() => applyPrize("")} disabled={applying}>
                取り消す
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setBulkAction("")}>
                キャンセル
              </Button>
            </>
          )}
          {bulkAction === "review" && (
            <>
              {REVIEW_STATUSES.map((rs) => (
                <Button
                  key={rs.value}
                  size="sm"
                  icon={<Plus />}
                  onClick={() => applyReview(rs.value, "add")}
                  disabled={applying}
                >
                  {rs.label}
                </Button>
              ))}
              <BarDivider />
              {REVIEW_STATUSES.map((rs) => (
                <Button
                  key={`rm-${rs.value}`}
                  size="sm"
                  icon={<Minus />}
                  aria-label={`${rs.label}を外す`}
                  onClick={() => applyReview(rs.value, "remove")}
                  disabled={applying}
                >
                  {rs.label}
                </Button>
              ))}
              <BarDivider />
              <Button
                size="sm"
                variant="dangerGhost"
                onClick={() => applyReview("", "clear")}
                disabled={applying}
              >
                すべて取り消す
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setBulkAction("")}>
                キャンセル
              </Button>
            </>
          )}
          {bulkAction === "arrival" && (
            <>
              {ITEM_ARRIVAL_STATUSES.map((rs) => (
                <Button
                  key={rs.value}
                  size="sm"
                  icon={<Plus />}
                  onClick={() => applyArrival(rs.value, "add")}
                  disabled={applying}
                >
                  {rs.label}
                </Button>
              ))}
              <BarDivider />
              {ITEM_ARRIVAL_STATUSES.map((rs) => (
                <Button
                  key={`rm-${rs.value}`}
                  size="sm"
                  icon={<Minus />}
                  aria-label={`${rs.label}を外す`}
                  onClick={() => applyArrival(rs.value, "remove")}
                  disabled={applying}
                >
                  {rs.label}
                </Button>
              ))}
              <BarDivider />
              <Button
                size="sm"
                variant="dangerGhost"
                onClick={() => applyArrival("", "clear")}
                disabled={applying}
              >
                すべて取り消す
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setBulkAction("")}>
                キャンセル
              </Button>
            </>
          )}
        </BulkActionBar>
      )}

      {/* Table */}
      <Table>
        <thead>
          <tr>
            {canBulkSelect && (
              <Th width="w-10" srLabel="選択">
                <Checkbox
                  checked={entries.length > 0 && selected.size === entries.length}
                  onChange={toggleAll}
                  aria-label="このページの全件を選択"
                />
              </Th>
            )}
            <Th width="w-16">写真</Th>
            <Th>商品名</Th>
            <Th>企業名</Th>
            <Th width="w-24">ご当地</Th>
            {permissions.canSeePrivateInfo && <Th>担当者</Th>}
            <Th>審査状況</Th>
            <Th>商品到着</Th>
            <Th>回答日</Th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <Tr key={entry.id} selected={selected.has(entry.id)}>
              {canBulkSelect && (
                <Td>
                  <Checkbox
                    checked={selected.has(entry.id)}
                    onChange={() => toggle(entry.id)}
                    aria-label={`${entry.productName}を選択`}
                  />
                </Td>
              )}
              <Td>
                <Thumb
                  src={entry.images[0] ? `/api/images/${entry.images[0].id}` : undefined}
                  alt=""
                />
              </Td>
              <Td primary>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/entries/${entry.id}${year ? `?year=${year}` : ""}`}
                    className={LINK_CLASS}
                  >
                    {entry.productName}
                  </Link>
                  <PrizeBadge prizeLevel={entry.prizeLevel} />
                </div>
              </Td>
              <Td>{entry.companyName}</Td>
              <Td>
                {entry.prefecture && <Badge tone="neutral">{entry.prefecture}</Badge>}
              </Td>
              {permissions.canSeePrivateInfo && (
                <Td>
                  {entry.contactLastName} {entry.contactFirstName}
                </Td>
              )}
              <Td>
                <ReviewBadge status={entry.reviewStatus} />
              </Td>
              <Td>
                <ItemArrivalBadge status={entry.itemArrivalStatus} />
              </Td>
              <Td subtle nowrap>
                {entry.answeredAt.split(" ")[0]}
              </Td>
            </Tr>
          ))}
          {entries.length === 0 && (
            <EmptyState
              colSpan={colCount}
              icon={ClipboardList}
              title="エントリーデータがありません"
              description={
                filtered
                  ? "検索条件に一致するエントリーがありません。条件を変えるかクリアしてください"
                  : "エントリーが取り込まれると、ここに表示されます"
              }
            />
          )}
        </tbody>
      </Table>
    </>
  );
}
