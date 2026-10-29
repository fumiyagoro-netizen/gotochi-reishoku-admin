"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUSES, type CampaignStatus } from "@/lib/retail-shared";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckPill } from "@/components/ui/check-pill";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/field-controls";
import { InlineConfirm } from "@/components/ui/inline-confirm";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Trash2 } from "@/components/ui/icons";

export interface CampaignFormValues {
  name: string;
  awardIds: number[];
  status: CampaignStatus;
  period: string;
  /** YYYY-MM-DD（JST）。空なら締切なし */
  deadline: string;
  description: string;
  memo: string;
}

const STATUS_HINT: Record<CampaignStatus, string> = {
  draft: "企業の申請ページには出ません。準備が整ったら「募集中」にします",
  open: "企業の申請ページに出て、締切日まで回答を受け付けます",
  closed: "企業の申請ページに出なくなります。記録はそのまま残ります",
};

export function CampaignForm({
  campaignId,
  initial,
  awards,
  recordCount = 0,
  yearQuery = "",
}: {
  /** 編集のとき。無ければ新規 */
  campaignId?: number;
  initial: CampaignFormValues;
  awards: { id: number; year: number; winners: number }[];
  /** 削除で消える回答・確定の件数（削除の確認文に出す） */
  recordCount?: number;
  yearQuery?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<CampaignFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set<K extends keyof CampaignFormValues>(key: K, value: CampaignFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function toggleAward(id: number) {
    setValues((v) => ({
      ...v,
      awardIds: v.awardIds.includes(id) ? v.awardIds.filter((a) => a !== id) : [...v.awardIds, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (values.awardIds.length === 0) {
      setError("対象年度を1つ以上選んでください");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(campaignId ? `/api/campaigns/${campaignId}` : "/api/campaigns", {
        method: campaignId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "保存に失敗しました");
        return;
      }
      router.push(`/campaigns/${data.campaign.id}${yearQuery}`);
      router.refresh();
    } catch (err) {
      setError("通信エラー: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!campaignId) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "削除に失敗しました");
        setDeleting(false);
        return;
      }
      router.push(`/campaigns${yearQuery}`);
      router.refresh();
    } catch (err) {
      setError("通信エラー: " + (err instanceof Error ? err.message : String(err)));
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <Alert tone="danger">{error}</Alert>}

      <Card className="space-y-5">
        <Field label="企画名" hint="小売店・通販サイトの名前など。企業の申請ページにもこの名前で出ます">
          <Input
            required
            maxLength={100}
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="例: 松屋銀座"
          />
        </Field>

        <div>
          <FieldLabel hint="複数選べます">対象年度</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {awards.map((a) => (
              <CheckPill key={a.id} checked={values.awardIds.includes(a.id)} onChange={() => toggleAward(a.id)}>
                {a.year}年度
                <span className="ml-1.5 text-caption text-ink-subtle tabular-nums">受賞{a.winners}品</span>
              </CheckPill>
            ))}
          </div>
          <p className="mt-1.5 text-caption text-ink-subtle">選んだ年度の受賞商品が、この企画の対象になります</p>
        </div>

        <div>
          <FieldLabel>状態</FieldLabel>
          <SegmentedControl
            value={values.status}
            onChange={(v) => set("status", v)}
            options={CAMPAIGN_STATUSES.map((s) => ({ value: s, label: CAMPAIGN_STATUS_LABELS[s] }))}
          />
          <p className="mt-1.5 text-caption text-ink-subtle">{STATUS_HINT[values.status]}</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="実施時期" labelHint="任意" hint="自由に書けます">
            <Input
              maxLength={100}
              value={values.period}
              onChange={(e) => set("period", e.target.value)}
              placeholder="例: 2027年1月15日〜21日"
            />
          </Field>
          <Field label="回答締切" labelHint="任意" hint="この日の終わりまで回答を受け付けます。空なら締切なし">
            <Input type="date" value={values.deadline} onChange={(e) => set("deadline", e.target.value)} />
          </Field>
        </div>

        <Field
          label="企業向けの説明"
          labelHint="任意"
          hint="申請ページの企画名の下に出ます。販売の形・条件・費用などを書いてください"
        >
          <Textarea
            rows={5}
            maxLength={2000}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>

        <Field label="事務局メモ" labelHint="任意・企業には出ません">
          <Textarea rows={3} maxLength={2000} value={values.memo} onChange={(e) => set("memo", e.target.value)} />
        </Field>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {campaignId &&
          (confirmDelete ? (
            <InlineConfirm
              message={
                recordCount > 0
                  ? `この企画と、記録済みの回答・確定 ${recordCount}件を削除します。元に戻せません`
                  : "この企画を削除します。元に戻せません"
              }
              confirmLabel="削除する"
              loadingLabel="削除中..."
              loading={deleting}
              onConfirm={handleDelete}
              onCancel={() => setConfirmDelete(false)}
            />
          ) : (
            <Button variant="dangerGhost" icon={<Trash2 />} onClick={() => setConfirmDelete(true)}>
              企画を削除
            </Button>
          ))}
        <div className="ml-auto flex gap-2">
          <ButtonLink variant="secondary" href={campaignId ? `/campaigns/${campaignId}${yearQuery}` : `/campaigns${yearQuery}`}>
            キャンセル
          </ButtonLink>
          <Button type="submit" variant="primary" loading={saving} disabled={saving}>
            保存する
          </Button>
        </div>
      </div>
    </form>
  );
}
