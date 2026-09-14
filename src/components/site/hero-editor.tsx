"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, GrandPrixBadge, PrizeBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SearchInput, Toolbar } from "@/components/ui/toolbar";
import { Thumb } from "@/components/ui/table";
import { ArrowDown, ArrowUp, Plus, X } from "@/components/ui/icons";
import { isPrizeLevel } from "@/lib/prize-shared";
import { MAX_HERO_ENTRIES } from "@/lib/site-collections-shared";

export type HeroCandidate = {
  id: number;
  productName: string;
  companyName: string;
  prefecture: string;
  prizeLevel: string;
  grandPrix: boolean;
  year: number;
  imageId: number | null;
};

// トップ掲載商品。自動は「その年度のグランプリ→最高金賞」から先頭4件。手動は選んだ順に並ぶ
export function HeroEditor({
  awardId,
  year,
  mode: savedMode,
  savedIds,
  autoIds,
  candidates,
}: {
  awardId: number;
  year: number;
  mode: "auto" | "manual";
  savedIds: number[];
  autoIds: number[];
  candidates: HeroCandidate[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"auto" | "manual">(savedMode);
  const [ids, setIds] = useState<number[]>(savedIds.length > 0 ? savedIds : autoIds);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const shown = mode === "auto" ? autoIds : ids;
  const dirty = mode !== savedMode || (mode === "manual" && JSON.stringify(ids) !== JSON.stringify(savedIds));

  const filtered = candidates.filter(
    (c) => !q.trim() || `${c.productName}${c.companyName}${c.prefecture}`.includes(q.trim()),
  );

  function move(i: number, d: -1 | 1) {
    setIds((prev) => {
      const next = [...prev];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/site/hero/${awardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroMode: mode, heroEntryIds: mode === "manual" ? ids : [] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || "保存に失敗しました");
      setMessage({ tone: "success", text: "保存しました" });
      router.refresh();
    } catch (e) {
      setMessage({ tone: "danger", text: e instanceof Error ? e.message : "保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  }

  function Row({ c, index }: { c: HeroCandidate; index?: number }) {
    return (
      <>
        <Thumb src={c.imageId ? `/api/images/${c.imageId}` : undefined} alt="" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {index != null && <span className="mr-1.5 font-semibold text-accent">{index + 1}</span>}
            {c.productName}
          </p>
          <p className="flex flex-wrap items-center gap-1.5 text-caption text-ink-subtle">
            {isPrizeLevel(c.prizeLevel) && <PrizeBadge prizeLevel={c.prizeLevel} size="sm" />}
            {c.grandPrix && <GrandPrixBadge size="sm" />}
            {c.year}年度・{c.companyName}
            {c.prefecture && `・${c.prefecture}`}
          </p>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <Card padding="none" as="section">
        <CardHeader
          title="表示のしかた"
          description={`自動は ${year}年度のグランプリ・最高金賞から先頭${MAX_HERO_ENTRIES}件。手動は選んだ順に並びます`}
          actions={
            <SegmentedControl
              value={mode}
              onChange={(v) => {
                setMode(v);
                setMessage(null);
                if (v === "manual" && ids.length === 0) setIds(autoIds);
              }}
              options={[
                { value: "auto", label: "自動" },
                { value: "manual", label: "手動で選ぶ" },
              ]}
            />
          }
        />
        <ul className="divide-y divide-line">
          {shown.map((id, i) => {
            const c = byId.get(id);
            if (!c) return null;
            return (
              <li key={id} className="flex items-center gap-3 px-5 py-3">
                <Row c={c} index={i} />
                {mode === "manual" && (
                  <span className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="sm" icon={<ArrowUp />} aria-label="上へ" disabled={i === 0} onClick={() => move(i, -1)} />
                    <Button variant="ghost" size="sm" icon={<ArrowDown />} aria-label="下へ" disabled={i === shown.length - 1} onClick={() => move(i, 1)} />
                    <Button variant="ghost" size="sm" icon={<X />} aria-label="外す" onClick={() => setIds((p) => p.filter((x) => x !== id))} />
                  </span>
                )}
                {mode === "auto" && <Badge tone="neutral" size="sm">自動</Badge>}
              </li>
            );
          })}
          {shown.length === 0 && (
            <li className="px-5 py-6 text-center text-sm text-ink-subtle">
              {mode === "auto" ? `${year}年度にグランプリ・最高金賞の商品がありません` : "下の候補から追加してください"}
            </li>
          )}
        </ul>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-3">
          {message && (
            <span className={message.tone === "success" ? "text-caption text-success-ink" : "text-caption text-danger-ink"}>{message.text}</span>
          )}
          {dirty && <span className="text-caption text-ink-subtle">未保存の変更があります</span>}
          <Button variant="primary" loading={saving} disabled={saving || !dirty} onClick={save}>
            保存
          </Button>
        </div>
      </Card>

      {mode === "manual" && (
        <Card padding="none" as="section">
          <CardHeader title="候補" description="受賞していて、サイトに公開している商品から選べます（年度をまたいで選べます）" />
          <div className="px-5 pt-4">
            <Toolbar>
              <SearchInput placeholder="商品名・企業名・都道府県" value={q} active={!!q} onChange={(e) => setQ(e.target.value)} />
            </Toolbar>
          </div>
          <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto border-t border-line">
            {filtered.slice(0, 60).map((c) => {
              const added = ids.includes(c.id);
              return (
                <li key={c.id} className="flex items-center gap-3 px-5 py-2.5">
                  <Row c={c} />
                  {added ? (
                    <Badge tone="info" size="sm">掲載中</Badge>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Plus />}
                      disabled={ids.length >= MAX_HERO_ENTRIES}
                      title={ids.length >= MAX_HERO_ENTRIES ? `${MAX_HERO_ENTRIES}件まで。先に1件外してください` : undefined}
                      onClick={() => setIds((p) => [...p, c.id])}
                    >
                      追加
                    </Button>
                  )}
                </li>
              );
            })}
            {filtered.length === 0 && <li className="px-5 py-6 text-center text-sm text-ink-subtle">条件に合う商品がありません</li>}
          </ul>
          {filtered.length > 60 && (
            <p className="px-5 py-3 text-caption text-ink-subtle">ほか {filtered.length - 60}件。検索で絞り込んでください</p>
          )}
        </Card>
      )}

      <Alert tone="info" compact>
        公開をやめた商品や受賞を取り消した商品は、自動的に外れます（保存し直す必要はありません）。
      </Alert>
    </div>
  );
}
