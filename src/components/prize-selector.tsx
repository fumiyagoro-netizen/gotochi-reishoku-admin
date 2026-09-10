"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PRIZE_LEVELS, PRIZE_DOT_CLASS, isPrizeLevel } from "@/lib/prize-shared";
import { Badge, PrizeBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TogglePill } from "@/components/ui/toggle-pill";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/popover";
import { Pencil, Trophy } from "@/components/ui/icons";

export function PrizeSelector({
  entryId,
  currentPrize,
}: {
  entryId: number;
  currentPrize: string;
}) {
  const [prize, setPrize] = useState(currentPrize);
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
        setOpen(false);
        router.refresh();
      }
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
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
        </div>
      ) : (
        <TogglePill pressed={false} icon={<Trophy />} onClick={() => setOpen(!open)}>
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
