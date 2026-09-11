"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TogglePill } from "@/components/ui/toggle-pill";
import { Input } from "@/components/ui/field-controls";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";

// 押した状態（公開中・掲載中）の色
const ON_CLASS = "border-success-line bg-success-soft text-success-ink";

/** 今日の日付（JST）を <input type="date"> と同じ "YYYY-MM-DD" で。終了日との比較用 */
function todayJst(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

type Change = { winnersPublished?: boolean; isFeatured?: boolean; featuredUntil?: string };
type Confirm = { title: string; body: string; label: string; danger?: boolean; change: Change };

/**
 * 受賞商品の公開画面の「年度の公開設定」。保存は /api/site/awards/[awardId]。
 * どちらのスイッチも確認ダイアログを通してから保存する（公開サイトに出るものが変わるため）。
 */
export function WinnersYearSettings({
  awardId,
  year,
  winnersPublished,
  isFeatured,
  featuredUntil,
  featuredExpired,
  otherFeaturedYear,
  prizedCount,
  publishedCount,
}: {
  awardId: number;
  year: number;
  winnersPublished: boolean;
  isFeatured: boolean;
  /** "YYYY-MM-DD"（JST）。未設定は "" */
  featuredUntil: string;
  /** 特別枠が ON だが終了日を過ぎている */
  featuredExpired: boolean;
  /** いま特別枠に掲載している別の年度（無ければ null） */
  otherFeaturedYear: number | null;
  prizedCount: number;
  publishedCount: number;
}) {
  const router = useRouter();
  // 終了日の初期値は README の運用どおり発表年の 6/30
  const [until, setUntil] = useState(featuredUntil || `${year}-06-30`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  async function save(change: Change): Promise<boolean> {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/site/awards/${awardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "保存に失敗しました");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("保存に失敗しました");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function askPublish() {
    setError("");
    setConfirm(
      winnersPublished
        ? {
            title: `${year}年度の受賞商品を非公開にします`,
            body:
              "公開サイトから、この年度の受賞商品がすべて消えます。特別枠に掲載している場合は、そちらもOFFになります。\n通常は発表後ずっと公開のままにします。",
            label: "非公開にする",
            danger: true,
            change: { winnersPublished: false },
          }
        : {
            title: `${year}年度の受賞商品を公開します`,
            body: `受賞商品 ${prizedCount}品のうち、「サイト」を公開にしている ${publishedCount}品が対象です。\n公開サイトに切り替えたあと、「過去の受賞商品」と年度別の一覧ページに表示されます。`,
            label: "公開する",
            change: { winnersPublished: true },
          },
    );
  }

  function askFeatured() {
    setError("");
    if (isFeatured) {
      setConfirm({
        title: "特別枠をOFFにします",
        body: `${year}年度はトップの特別枠から外れ、「過去の受賞商品」の最新の年度として表示されます。受賞商品の公開はそのままです。`,
        label: "OFFにする",
        change: { isFeatured: false },
      });
      return;
    }
    const lines = [
      !winnersPublished && "受賞商品がまだ非公開なので、あわせて公開にします。",
      otherFeaturedYear && `いま特別枠に掲載している ${otherFeaturedYear}年度はOFFになります（特別枠は同時に1年度だけ）。`,
      `終了日: ${until}（この日を過ぎると自動でOFFとして扱います）`,
    ].filter(Boolean);
    setConfirm({
      title: `${year}年度を特別枠に掲載します`,
      body: lines.join("\n"),
      label: "掲載する",
      change: { isFeatured: true, featuredUntil: until },
    });
  }

  async function onConfirm() {
    if (!confirm) return;
    if (await save(confirm.change)) setConfirm(null);
  }

  return (
    <>
      <Card padding="none" as="section">
        <CardHeader
          title={`${year}年度の公開設定`}
          description="公開サイトに切り替えたとき、この年度の受賞商品をどう出すかを決めます。"
        />
        <div className="grid md:grid-cols-2 md:divide-x md:divide-line">
          <div className="space-y-2 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">受賞商品を公開</p>
              <TogglePill
                pressed={winnersPublished}
                toneClassName={ON_CLASS}
                disabled={saving || prizedCount === 0}
                onClick={askPublish}
              >
                {winnersPublished ? "公開中" : "非公開"}
              </TogglePill>
            </div>
            <p className="text-caption text-ink-subtle">
              ONにすると「過去の受賞商品」と年度別の一覧ページに出ます。発表時にONにして、以後ずっとONのままにします。
            </p>
          </div>

          <div className="space-y-2 border-t border-line p-5 md:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">最新の受賞発表として特別枠に掲載</p>
              <TogglePill
                pressed={isFeatured}
                toneClassName={ON_CLASS}
                disabled={saving || prizedCount === 0}
                onClick={askFeatured}
              >
                {isFeatured ? "掲載中" : "OFF"}
              </TogglePill>
            </div>
            <p className="text-caption text-ink-subtle">
              トップの特別枠に出す年度（同時に1年度だけ）。終了日を過ぎると自動でOFF扱いになり、「過去の受賞商品」の最新の年度として表示されます。
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <label htmlFor="featured-until" className="text-caption font-medium text-ink">
                終了日
              </label>
              <div className="w-40">
                <Input
                  id="featured-until"
                  type="date"
                  size="sm"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                />
              </div>
              {isFeatured && until !== featuredUntil && (
                <Button size="sm" loading={saving} disabled={saving || !until} onClick={() => save({ featuredUntil: until })}>
                  終了日を保存
                </Button>
              )}
            </div>
            {until && until <= todayJst() && !featuredExpired && (
              <p className="text-caption text-warning-ink">
                終了日が今日以前です。特別枠をONにするときは、今日より後の日付を選んでください。
              </p>
            )}
            {featuredExpired && (
              <Alert tone="warning" compact>
                終了日を過ぎているため、公開サイトでは特別枠に表示されません。延長する場合は終了日を変えて保存してください。
              </Alert>
            )}
          </div>
        </div>
        {error && (
          <div className="px-5 pb-4">
            <Alert tone="danger" compact>
              {error}
            </Alert>
          </div>
        )}
      </Card>

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.title ?? ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              キャンセル
            </Button>
            <Button variant={confirm?.danger ? "danger" : "primary"} loading={saving} disabled={saving} onClick={onConfirm}>
              {confirm?.label}
            </Button>
          </>
        }
      >
        <p className="whitespace-pre-line text-sm text-ink-muted">{confirm?.body}</p>
        {error && (
          <div className="mt-3">
            <Alert tone="danger" compact>
              {error}
            </Alert>
          </div>
        )}
      </Modal>
    </>
  );
}
