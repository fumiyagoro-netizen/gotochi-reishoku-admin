"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/field-controls";
import { Alert } from "@/components/ui/alert";

type Msg = { tone: "success" | "danger"; text: string } | null;

async function put(url: string, body: unknown) {
  const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.message || "保存に失敗しました");
}

/** ダイジェストムービー（年度ごと）。保存は /api/site/digest/[awardId] */
export function DigestForm({ awardId, year, videoId, caption }: { awardId: number; year: number; videoId: string; caption: string }) {
  const router = useRouter();
  const [id, setId] = useState(videoId);
  const [cap, setCap] = useState(caption);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const dirty = id !== videoId || cap !== caption;
  // 入力が動画IDのときだけサムネイルを出す（URL を貼った直後は保存後に出る）
  const thumb = /^[A-Za-z0-9_-]{11}$/.test(id.trim()) ? `https://i.ytimg.com/vi/${id.trim()}/hqdefault.jpg` : "";

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await put(`/api/site/digest/${awardId}`, { digestVideoId: id, digestCaption: cap });
      setMsg({ tone: "success", text: "保存しました" });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "danger", text: e instanceof Error ? e.message : "保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="none" as="section">
      <CardHeader title="ダイジェストムービー" description={`${year}年度。トップの紺色の帯に出て、押すと再生します`} />
      <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="grid gap-5">
          <Field label="YouTube の動画ID" htmlFor="digest-id" hint="動画のURL（https://youtu.be/... など）を貼っても、IDだけ取り出して保存します。空にすると帯ごと出ません">
            <Input id="digest-id" value={id} placeholder="4go8UZUDwWA" onChange={(e) => setId(e.target.value)} />
          </Field>
          <Field label="説明" htmlFor="digest-cap" hint="サムネイルの上に小さく出ます">
            <Input id="digest-cap" value={cap} placeholder="第2回 最終審査会・表彰式のダイジェスト" onChange={(e) => setCap(e.target.value)} />
          </Field>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">サムネイル</p>
          {thumb ? (
            <img src={thumb} alt="" className="aspect-video w-full rounded-md border border-line object-cover" />
          ) : (
            <div className="grid aspect-video w-full place-items-center rounded-md bg-surface-muted text-caption text-ink-subtle">
              動画IDを入れると出ます
            </div>
          )}
          <p className="mt-1.5 text-caption text-ink-subtle">YouTube のサムネイルを自動で使います</p>
        </div>
      </div>
      <CardFooter start={msg && <span className={msg.tone === "success" ? "text-caption text-success-ink" : "text-caption text-danger-ink"}>{msg.text}</span>}>
        {dirty && <span className="text-caption text-ink-subtle">未保存の変更があります</span>}
        <Button variant="primary" loading={saving} disabled={saving || !dirty} onClick={save}>
          保存
        </Button>
      </CardFooter>
    </Card>
  );
}

/** 「この他、○○など多数のメディアに掲載」に出す媒体名。サイト全体の設定の一部 */
export function MediaOutletsForm({ value }: { value: string }) {
  const router = useRouter();
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await put("/api/site/config", { mediaOutlets: text });
      setMsg({ tone: "success", text: "保存しました" });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "danger", text: e instanceof Error ? e.message : "保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="none" as="section">
      <CardHeader title="媒体名の一覧" description="動画の下に「この他、…など多数のメディアに掲載されています」の形で出ます" />
      <div className="p-5">
        <Field label="媒体名" htmlFor="outlets" hint="「、」で区切って書きます（例: めざましテレビ（フジテレビ）、ひるおび（TBS））">
          <Textarea id="outlets" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      </div>
      <CardFooter start={msg && <span className={msg.tone === "success" ? "text-caption text-success-ink" : "text-caption text-danger-ink"}>{msg.text}</span>}>
        {text !== value && <span className="text-caption text-ink-subtle">未保存の変更があります</span>}
        <Button variant="primary" loading={saving} disabled={saving || text === value} onClick={save}>
          保存
        </Button>
      </CardFooter>
    </Card>
  );
}
