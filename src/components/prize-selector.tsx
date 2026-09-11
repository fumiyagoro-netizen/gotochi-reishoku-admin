"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PRIZE_LEVELS,
  PRIZE_DOT_CLASS,
  GRAND_PRIX_PRIZE_LEVEL,
  GRAND_PRIX_PILL_CLASS,
  isPrizeLevel,
} from "@/lib/prize-shared";
import { Badge, PrizeBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TogglePill } from "@/components/ui/toggle-pill";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/popover";
import { Pencil, Trophy } from "@/components/ui/icons";

export function PrizeSelector({
  entryId,
  currentPrize,
  grandPrix = false,
}: {
  entryId: number;
  currentPrize: string;
  /** グランプリ（称号）が付いているか。最高金賞のときだけ付け外しできる */
  grandPrix?: boolean;
}) {
  const [prize, setPrize] = useState(currentPrize);
  const [gp, setGp] = useState(grandPrix);
  const [gpSaving, setGpSaving] = useState(false);
  const [gpNote, setGpNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function setPrizeLevel(level: string) {
    const newLevel = level === prize ? "" : level;
    setSaving(true);
    try {
      const res = await fetch(`/api/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prizeLevel: newLevel }),
      });
      const data = await res.json();
      if (data.success) {
        setPrize(newLevel);
        // 最高金賞から外すとサーバー側でグランプリも外れる（api/entries/[id] の PATCH）
        if (newLevel !== GRAND_PRIX_PRIZE_LEVEL) setGp(false);
        setOpen(false);
        router.refresh();
      }
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function toggleGrandPrix() {
    setGpSaving(true);
    setGpNote("");
    try {
      const res = await fetch(`/api/entries/${entryId}/grand-prix`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grandPrix: !gp }),
      });
      const data = await res.json();
      if (data.success) {
        setGp(data.grandPrix);
        if (data.replaced?.length) setGpNote(`${data.replaced.join("、")} から付け替えました`);
        router.refresh();
      } else {
        alert(data.message || "保存に失敗しました");
      }
    } catch {
      alert("保存に失敗しました");
    } finally {
      setGpSaving(false);
    }
  }

  return (
    // Popover の外側クリック判定はこの relative ラッパー基準（トリガーを含む）
    <div className="relative">
      {prize ? (
        <div className="flex items-center gap-2">
          {/* 既知の賞は賞色バッジ。未知の値でも落とさず素の文字列で見せる */}
          {isPrizeLevel(prize) ? (
            <PrizeBadge prizeLevel={prize} />
          ) : (
            <Badge tone="neutral" icon={<Trophy />}>
              {prize}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            icon={<Pencil />}
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-haspopup="menu"
          >
            変更
          </Button>
          {prize === GRAND_PRIX_PRIZE_LEVEL && (
            <TogglePill
              pressed={gp}
              pending={gpSaving}
              disabled={gpSaving}
              toneClassName={GRAND_PRIX_PILL_CLASS}
              onClick={toggleGrandPrix}
              title="最高金賞の中から1年度に1品。付けると同じ年度の別の商品からは外れます"
            >
              グランプリ
            </TogglePill>
          )}
          {gpNote && <span className="text-caption text-ink-subtle">{gpNote}</span>}
        </div>
      ) : (
        // 「変更」ボタンと同じくメニューのトリガーなので aria-expanded / aria-haspopup を揃える
        <TogglePill
          pressed={false}
          icon={<Trophy />}
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          受賞を設定
        </TogglePill>
      )}

      <Popover open={open} onClose={() => setOpen(false)}>
        {PRIZE_LEVELS.map((level) => (
          <MenuItem
            key={level}
            selected={prize === level}
            dotClassName={PRIZE_DOT_CLASS[level]}
            disabled={saving}
            onClick={() => setPrizeLevel(level)}
          >
            {level}
          </MenuItem>
        ))}
        {prize && (
          <>
            <MenuSeparator />
            <MenuItem tone="danger" disabled={saving} onClick={() => setPrizeLevel("")}>
              受賞を取り消す
            </MenuItem>
          </>
        )}
      </Popover>
    </div>
  );
}

// 本体は ui/badge.tsx に移った。import 先（entry-table 等）を変えずに済むよう再 export する
export { PrizeBadge } from "@/components/ui/badge";
