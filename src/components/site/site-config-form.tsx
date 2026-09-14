"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/field-controls";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "@/components/ui/icons";
import { ImageField } from "./site-image-field";
import { MAX_FOOTER_LINKS, type SiteConfigValues } from "@/lib/site-config-shared";

// バナー・サイト設定。保存は /api/site/config（送った項目だけ更新される）
export function SiteConfigForm({
  initial,
  today,
  forms,
}: {
  initial: SiteConfigValues;
  today: string;
  /** フォーム作成で「公開」にしてあるフォーム */
  forms: { slug: string; title: string }[];
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  const set = <K extends keyof SiteConfigValues>(key: K, value: SiteConfigValues[K]) => setV((o) => ({ ...o, [key]: value }));

  // いま表示される状態か（期間内で、表示ONで、文言がある）
  const live = v.bannerOn && !!v.bannerText && (!v.bannerFrom || v.bannerFrom <= today) && (!v.bannerTo || today <= v.bannerTo);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/site/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
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

  return (
    <div className="space-y-6">
      <Card padding="none" as="section">
        <CardHeader
          title="お知らせバナー"
          description="ページ最上部に出る1行のバナー（説明会の案内など）。閲覧者が閉じると、そのセッション中は出ません"
        />
        <div className="grid gap-5 p-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field inline label="バナーを表示する" htmlFor="banner-on">
              <Checkbox id="banner-on" checked={v.bannerOn} onChange={(e) => set("bannerOn", e.target.checked)} />
            </Field>
          </div>
          <Field label="ラベル" htmlFor="banner-tag">
            <Input id="banner-tag" value={v.bannerTag} placeholder="INFO" onChange={(e) => set("bannerTag", e.target.value)} />
          </Field>
          <Field label="リンクの文言" htmlFor="banner-linktext" hint="空にするとリンクを出しません">
            <Input id="banner-linktext" value={v.bannerLinkText} placeholder="参加申込" onChange={(e) => set("bannerLinkText", e.target.value)} />
          </Field>
          <div className="md:col-span-2">
            <Field label="文言" htmlFor="banner-text" labelHint={`${v.bannerText.length} / 60字くらいまで`}>
              <Input id="banner-text" value={v.bannerText} onChange={(e) => set("bannerText", e.target.value)} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="リンク先" htmlFor="banner-url" hint="サイト内なら /entry のように、外部なら https:// から">
              <Input id="banner-url" value={v.bannerUrl} placeholder="/entry" onChange={(e) => set("bannerUrl", e.target.value)} />
            </Field>
          </div>
          <Field label="表示開始" htmlFor="banner-from" hint="空なら制限なし">
            <Input id="banner-from" type="date" value={v.bannerFrom} onChange={(e) => set("bannerFrom", e.target.value)} />
          </Field>
          <Field label="表示終了" htmlFor="banner-to" hint="その日いっぱい表示します">
            <Input id="banner-to" type="date" value={v.bannerTo} onChange={(e) => set("bannerTo", e.target.value)} />
          </Field>

          <div className="md:col-span-2">
            <p className="mb-1.5 text-sm font-medium text-ink">プレビュー</p>
            <div className={`flex items-center gap-3 rounded-md bg-ink px-4 py-2.5 text-sm text-white ${live ? "" : "opacity-40"}`}>
              {v.bannerTag && <span className="rounded bg-cyan-300 px-1.5 py-0.5 text-caption font-semibold text-ink">{v.bannerTag}</span>}
              <span className="min-w-0 flex-1">{v.bannerText || "（文言を入れてください）"}</span>
              {v.bannerLinkText && v.bannerUrl && <span className="shrink-0 font-medium underline">{v.bannerLinkText}</span>}
              <span aria-hidden="true" className="shrink-0 opacity-70">×</span>
            </div>
            <p className="mt-1.5 text-caption text-ink-subtle">
              {live
                ? "いまの設定では表示されます"
                : !v.bannerOn
                  ? "「バナーを表示する」が外れています"
                  : !v.bannerText
                    ? "文言が空です"
                    : "いまは表示期間の外です"}
              {v.bannerLinkText && !v.bannerUrl && "・リンク先が空なのでリンクは出ません"}
            </p>
          </div>
        </div>
      </Card>

      <Card padding="none" as="section">
        <CardHeader title="SNSで共有したときの表示（OGP）" description="LINE・X・Facebook などにURLを貼ったときに出るタイトル・説明・画像" />
        <div className="grid gap-5 p-5">
          <Field label="タイトル" htmlFor="og-title">
            <Input id="og-title" value={v.ogTitle} placeholder="日本全国！ご当地冷凍食品大賞 2027" onChange={(e) => set("ogTitle", e.target.value)} />
          </Field>
          <Field label="説明文" htmlFor="og-desc">
            <Textarea id="og-desc" rows={2} value={v.ogDescription} onChange={(e) => set("ogDescription", e.target.value)} />
          </Field>
          <Field label="画像" hint="横長（1200×630px 程度）がきれいに出ます。未設定のときはサイトの既定画像を使います">
            <ImageField kind="og" value={v.ogImageUrl} onChange={(url) => set("ogImageUrl", url)} />
          </Field>
        </div>
      </Card>

      <Card padding="none" as="section">
        <CardHeader
          title="公開サイトから開くフォーム"
          description="サイトの「お問い合わせ」「説明会に参加する」を押すと、その場でフォームが開きます。フォーム作成で公開にしたものから選びます"
        />
        <div className="grid gap-5 p-5 md:grid-cols-2">
          <Field label="お問い合わせ" htmlFor="form-contact" hint="選ばないと、サイトにお問い合わせのボタンを出しません">
            <Select id="form-contact" value={v.contactFormSlug} onChange={(e) => set("contactFormSlug", e.target.value)}>
              <option value="">使わない</option>
              {forms.map((f) => (
                <option key={f.slug} value={f.slug}>{f.title}</option>
              ))}
            </Select>
          </Field>
          <Field label="説明会の申し込み" htmlFor="form-briefing" hint="募集期間中だけ出したいときは、フォーム側を「公開」「終了」で切り替えます">
            <Select id="form-briefing" value={v.briefingFormSlug} onChange={(e) => set("briefingFormSlug", e.target.value)}>
              <option value="">使わない</option>
              {forms.map((f) => (
                <option key={f.slug} value={f.slug}>{f.title}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card padding="none" as="section">
        <CardHeader title="実績数" description="トップの上部に出る数字。第1回は受賞商品だけを取り込んでいるため、管理画面の件数ではなく実数を入れます" />
        <div className="grid gap-5 p-5 md:grid-cols-2">
          <Field label="エントリー累計" htmlFor="stats-entries" hint="例: 187（品）">
            <Input id="stats-entries" type="number" min={0} align="right" value={v.statsEntries} onChange={(e) => set("statsEntries", Number(e.target.value))} />
          </Field>
          <Field label="参加都道府県" htmlFor="stats-prefs" hint="47 までの数字">
            <Input id="stats-prefs" type="number" min={0} max={47} align="right" value={v.statsPrefectures} onChange={(e) => set("statsPrefectures", Number(e.target.value))} />
          </Field>
        </div>
      </Card>

      <Card padding="none" as="section">
        <CardHeader title="フッターのリンク" description={`最大${MAX_FOOTER_LINKS}件。並び順どおりに出ます`} />
        <div className="space-y-2 p-5">
          {v.footerLinks.map((link, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-2">
              <Input size="sm" value={link.label} aria-label="表示名" placeholder="プライバシーポリシー" onChange={(e) => set("footerLinks", v.footerLinks.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)))} />
              <Input size="sm" value={link.url} aria-label="リンク先" placeholder="/privacy" onChange={(e) => set("footerLinks", v.footerLinks.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)))} />
              <span className="inline-flex">
                <Button variant="ghost" size="sm" icon={<ArrowUp />} aria-label="上へ" disabled={i === 0} onClick={() => set("footerLinks", (() => { const n = [...v.footerLinks]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })())} />
                <Button variant="ghost" size="sm" icon={<ArrowDown />} aria-label="下へ" disabled={i === v.footerLinks.length - 1} onClick={() => set("footerLinks", (() => { const n = [...v.footerLinks]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })())} />
                <Button variant="ghost" size="sm" icon={<Trash2 />} aria-label="削除" onClick={() => set("footerLinks", v.footerLinks.filter((_, j) => j !== i))} />
              </span>
            </div>
          ))}
          {v.footerLinks.length === 0 && <p className="text-sm text-ink-subtle">まだありません</p>}
          {v.footerLinks.length < MAX_FOOTER_LINKS && (
            <Button variant="ghost" size="sm" icon={<Plus />} onClick={() => set("footerLinks", [...v.footerLinks, { label: "", url: "" }])}>
              リンクを追加
            </Button>
          )}
        </div>
      </Card>

      <Card padding="none" as="section">
        <CardHeader title="プライバシーポリシー" description="サイト内のページ（/privacy）に出ます" />
        <div className="grid gap-5 p-5">
          <Field label="本文" htmlFor="privacy-body" hint="改行はそのまま表示します">
            <Textarea id="privacy-body" rows={8} value={v.privacyBody} onChange={(e) => set("privacyBody", e.target.value)} />
          </Field>
          <Field label="最終更新日" htmlFor="privacy-date">
            <Input id="privacy-date" type="date" value={v.privacyUpdatedAt} onChange={(e) => set("privacyUpdatedAt", e.target.value)} />
          </Field>
        </div>
        <CardFooter start={message && <Alert tone={message.tone} compact>{message.text}</Alert>}>
          {dirty && <span className="text-caption text-ink-subtle">未保存の変更があります</span>}
          <Button variant="primary" loading={saving} disabled={saving || !dirty} onClick={save}>
            サイト設定を保存
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
