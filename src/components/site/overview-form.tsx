"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { FileInput, Input, Textarea } from "@/components/ui/field-controls";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2 } from "@/components/ui/icons";
import { uploadSiteFile } from "./site-image-field";
import {
  OVERVIEW_MAX_FEES,
  OVERVIEW_MAX_TIMELINE,
  feeProblems,
  type SiteOverview,
} from "@/lib/site-overview-shared";

// 開催概要（年度ごと）。保存は /api/site/overview/[awardId]

export function OverviewForm({
  awardId,
  year,
  initial,
  initialAnnounceDate,
  initialLeafletUrl,
  entryStart,
  entryEnd,
}: {
  awardId: number;
  year: number;
  initial: SiteOverview;
  initialAnnounceDate: string;
  initialLeafletUrl: string;
  /** 年度管理の受付期間（"YYYY-MM-DD"、未設定は ""） */
  entryStart: string;
  entryEnd: string;
}) {
  const router = useRouter();
  const [ov, setOv] = useState(initial);
  const [announceDate, setAnnounceDate] = useState(initialAnnounceDate);
  const [leafletUrl, setLeafletUrl] = useState(initialLeafletUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const dirty =
    JSON.stringify(ov) !== JSON.stringify(initial) || announceDate !== initialAnnounceDate || leafletUrl !== initialLeafletUrl;
  const problems = feeProblems(ov.fees, entryStart, entryEnd);

  const setField = (key: keyof SiteOverview, value: string) => setOv((o) => ({ ...o, [key]: value }));
  const setFee = (i: number, patch: Partial<SiteOverview["fees"][number]>) =>
    setOv((o) => ({ ...o, fees: o.fees.map((f, j) => (j === i ? { ...f, ...patch } : f)) }));
  const setTl = (i: number, patch: Partial<SiteOverview["timeline"][number]>) =>
    setOv((o) => ({ ...o, timeline: o.timeline.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));
  const moveTl = (i: number, d: -1 | 1) =>
    setOv((o) => {
      const t = [...o.timeline];
      [t[i], t[i + d]] = [t[i + d], t[i]];
      return { ...o, timeline: t };
    });

  async function onLeaflet(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      setLeafletUrl(await uploadSiteFile("leaflet", file));
    } catch (err) {
      setMessage({ tone: "danger", text: err instanceof Error ? err.message : "アップロードに失敗しました" });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/site/overview/${awardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overview: ov, announceDate, leafletUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || "保存に失敗しました");
      setMessage({ tone: "success", text: "保存しました" });
      router.refresh();
    } catch (err) {
      setMessage({ tone: "danger", text: err instanceof Error ? err.message : "保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card padding="none" as="section">
        <CardHeader title="名称と募集要項" />
        <div className="grid gap-5 p-5">
          <Field label="名称" htmlFor="ov-name">
            <Input id="ov-name" value={ov.name} placeholder={`例: 第3回 日本全国！ご当地冷凍食品大賞 ${year}`} onChange={(e) => setField("name", e.target.value)} />
          </Field>
          <Field label="対象商品" htmlFor="ov-target">
            <Textarea id="ov-target" rows={2} value={ov.target} onChange={(e) => setField("target", e.target.value)} />
          </Field>
          <Field label="応募資格" htmlFor="ov-elig">
            <Textarea id="ov-elig" rows={2} value={ov.eligibility} onChange={(e) => setField("eligibility", e.target.value)} />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">募集期間</p>
            <p className="text-sm text-ink-muted">
              {entryStart && entryEnd ? `${entryStart} 〜 ${entryEnd}` : "未設定"}
              <span className="ml-2 text-caption text-ink-subtle">
                年度管理の受付期間をそのまま使います（締切のカウントダウンもこの日付）。
                <Link href="/award-settings" className="text-accent hover:underline">
                  年度管理で変える
                </Link>
              </span>
            </p>
          </div>
        </div>
      </Card>

      <Card padding="none" as="section">
        <CardHeader title="エントリー費（税抜）" description="書類選考は無料で、試食審査に進む商品にだけ発生します。今日が入っている区分をサイトで強調します" />
        <div className="space-y-3 p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_repeat(2,minmax(0,1fr))_minmax(0,1fr)_auto] items-center gap-2 text-caption font-medium text-ink-subtle">
            <span>区分</span>
            <span>開始</span>
            <span>終了</span>
            <span>金額（円）</span>
            <span className="w-8" />
          </div>
          {ov.fees.map((f, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_repeat(2,minmax(0,1fr))_minmax(0,1fr)_auto] items-center gap-2">
              <Input size="sm" value={f.label} aria-label="区分" onChange={(e) => setFee(i, { label: e.target.value })} />
              <Input size="sm" type="date" value={f.from} aria-label={`${f.label} 開始`} onChange={(e) => setFee(i, { from: e.target.value })} />
              <Input size="sm" type="date" value={f.to} aria-label={`${f.label} 終了`} onChange={(e) => setFee(i, { to: e.target.value })} />
              <Input
                size="sm"
                type="number"
                min={0}
                step={1000}
                align="right"
                value={f.amount ?? ""}
                aria-label={`${f.label} 金額`}
                onChange={(e) => setFee(i, { amount: e.target.value === "" ? null : Number(e.target.value) })}
              />
              <Button variant="ghost" size="sm" icon={<Trash2 />} aria-label="この区分を削除" onClick={() => setOv((o) => ({ ...o, fees: o.fees.filter((_, j) => j !== i) }))} />
            </div>
          ))}
          {ov.fees.length < OVERVIEW_MAX_FEES && (
            <Button variant="ghost" size="sm" icon={<Plus />} onClick={() => setOv((o) => ({ ...o, fees: [...o.fees, { label: "", from: "", to: "", amount: null }] }))}>
              区分を追加
            </Button>
          )}
          {problems.length > 0 ? (
            <Alert tone="warning" compact title="期間を確認してください">
              <ul className="list-disc pl-5">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Alert>
          ) : (
            ov.fees.some((f) => f.from) && (
              <Alert tone="success" compact>
                各区分の期間が受付期間をすき間なく覆っています。
              </Alert>
            )
          )}
        </div>
      </Card>

      <Card padding="none" as="section">
        <CardHeader title="審査・発表・特典" />
        <div className="grid gap-5 p-5 md:grid-cols-2">
          <Field label="受賞発表日" htmlFor="ov-ann" hint="発表日の段取り（受賞商品の公開など）の目安に使います">
            <Input id="ov-ann" type="date" value={announceDate} onChange={(e) => setAnnounceDate(e.target.value)} />
          </Field>
          <Field label="発表の表記" htmlFor="ov-annt" hint="サイトにはこの文言が出ます">
            <Input id="ov-annt" value={ov.announceText} placeholder="例: 2027年1月下旬 プレス向け発表会・表彰式（予定）" onChange={(e) => setField("announceText", e.target.value)} />
          </Field>
          <div className="md:col-span-2">
            <Field label="展示" htmlFor="ov-ex">
              <Input id="ov-ex" value={ov.exhibition} placeholder="例: 第61回スーパーマーケット・トレードショー2027（2月17日〜19日）" onChange={(e) => setField("exhibition", e.target.value)} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="受賞特典" htmlFor="ov-perks" hint="「／」で区切ると箇条で表示します">
              <Textarea id="ov-perks" rows={3} value={ov.perks} onChange={(e) => setField("perks", e.target.value)} />
            </Field>
          </div>
        </div>
      </Card>

      <Card padding="none" as="section">
        <CardHeader title="募集要項リーフレット（PDF）" />
        <div className="space-y-3 p-5">
          {leafletUrl ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <a href={leafletUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                登録済みのリーフレットを開く
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
              <Button variant="linkDanger" size="sm" onClick={() => setLeafletUrl("")}>
                外す
              </Button>
            </div>
          ) : (
            <p className="text-sm text-ink-subtle">まだ登録されていません</p>
          )}
          <FileInput accept="application/pdf" hint={uploading ? "アップロード中…" : "PDF・4MBまで"} disabled={uploading} onChange={onLeaflet} />
        </div>
      </Card>

      <Card padding="none" as="section">
        <CardHeader title="タイムライン" description="開催概要の下に出る年表。上から順に並びます" />
        <div className="space-y-2 p-5">
          {ov.timeline.map((t, i) => (
            <div key={i} className="grid grid-cols-[9rem_12rem_minmax(0,1fr)_auto] items-center gap-2">
              <Input size="sm" value={t.date} placeholder="2026.08.01" aria-label="日付の表記" onChange={(e) => setTl(i, { date: e.target.value })} />
              <Input size="sm" value={t.title} placeholder="エントリー開始" aria-label="見出し" onChange={(e) => setTl(i, { title: e.target.value })} />
              <Input size="sm" value={t.note} placeholder="補足" aria-label="補足" onChange={(e) => setTl(i, { note: e.target.value })} />
              <span className="inline-flex">
                <Button variant="ghost" size="sm" icon={<ArrowUp />} aria-label="上へ" disabled={i === 0} onClick={() => moveTl(i, -1)} />
                <Button variant="ghost" size="sm" icon={<ArrowDown />} aria-label="下へ" disabled={i === ov.timeline.length - 1} onClick={() => moveTl(i, 1)} />
                <Button variant="ghost" size="sm" icon={<Trash2 />} aria-label="削除" onClick={() => setOv((o) => ({ ...o, timeline: o.timeline.filter((_, j) => j !== i) }))} />
              </span>
            </div>
          ))}
          {ov.timeline.length === 0 && <p className="text-sm text-ink-subtle">まだありません</p>}
          {ov.timeline.length < OVERVIEW_MAX_TIMELINE && (
            <Button variant="ghost" size="sm" icon={<Plus />} onClick={() => setOv((o) => ({ ...o, timeline: [...o.timeline, { date: "", title: "", note: "" }] }))}>
              行を追加
            </Button>
          )}
        </div>
        <CardFooter start={message && <span className={message.tone === "success" ? "text-caption text-success-ink" : "text-caption text-danger-ink"}>{message.text}</span>}>
          {dirty && <span className="text-caption text-ink-subtle">未保存の変更があります</span>}
          <Button variant="primary" loading={saving} disabled={saving || uploading || !dirty} onClick={save}>
            {year}年度の開催概要を保存
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
