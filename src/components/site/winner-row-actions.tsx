"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TogglePill } from "@/components/ui/toggle-pill";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/cn";

// 受賞商品の公開画面の行内操作。保存は /api/site/entries/[id]

const ON_CLASS = "border-success-line bg-success-soft text-success-ink";
const MAX_PHOTOS = 3;

async function patchSiteEntry(entryId: number, body: Record<string, unknown>) {
  const res = await fetch(`/api/site/entries/${entryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.message || "保存に失敗しました");
}

/** 商品ごとの「サイトに公開」。年度の「受賞商品を公開」が ON のとき、ON の商品だけがサイトに出る */
export function SitePublishToggle({
  entryId,
  productName,
  published,
}: {
  entryId: number;
  productName: string;
  published: boolean;
}) {
  const [on, setOn] = useState(published);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function toggle() {
    setPending(true);
    try {
      await patchSiteEntry(entryId, { sitePublished: !on });
      setOn(!on);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setPending(false);
    }
  }

  return (
    <TogglePill
      pressed={on}
      pending={pending}
      disabled={pending}
      toneClassName={ON_CLASS}
      onClick={toggle}
      aria-label={`${productName}：サイトに${on ? "公開中（押すと非公開）" : "非公開（押すと公開）"}`}
    >
      {on ? "公開" : "非公開"}
    </TogglePill>
  );
}

type PickerImage = { id: number; imageType: string };

/** サイトに出す写真（最大3枚、押した順）。何も選ばないとメイン画像1枚を出す */
export function SitePhotoPicker({
  entryId,
  productName,
  images,
  selected,
}: {
  entryId: number;
  productName: string;
  images: PickerImage[];
  selected: number[];
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number[]>(selected);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  if (images.length === 0) return null;

  // 表示用のラベル（メイン／サブ1…）は並び順から先に作る
  let subNo = 0;
  const labels = images.map((img) => (img.imageType === "main" ? "メイン" : `サブ${++subNo}`));

  function openModal() {
    setPicked(selected);
    setError("");
    setOpen(true);
  }

  function toggle(id: number) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_PHOTOS ? p : [...p, id]));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await patchSiteEntry(entryId, { sitePhotoIds: picked.length > 0 ? picked : null });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="link" size="sm" onClick={openModal}>
        写真を選ぶ
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="サイトに出す写真"
        description={`${productName}：押した順にスライドの1〜${MAX_PHOTOS}枚目になります。何も選ばないとメイン画像を1枚だけ出します。`}
        size="lg"
        footerStart={
          <Button variant="ghost" size="sm" disabled={saving || picked.length === 0} onClick={() => setPicked([])}>
            選択をすべて外す
          </Button>
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button variant="primary" loading={saving} disabled={saving} onClick={save}>
              保存
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-3 gap-3">
          {images.map((img, i) => {
            const order = picked.indexOf(img.id);
            return (
              <button
                key={img.id}
                type="button"
                onClick={() => toggle(img.id)}
                aria-pressed={order >= 0}
                aria-label={`${labels[i]}を${order >= 0 ? "外す" : "選ぶ"}`}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-md border bg-surface-muted transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                  order >= 0 ? "border-accent ring-2 ring-accent" : "border-line hover:border-line-strong",
                )}
              >
                <img src={`/api/images/${img.id}`} alt="" className="size-full object-cover" />
                {order >= 0 && (
                  <span className="absolute left-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-accent text-caption font-semibold text-white">
                    {order + 1}
                  </span>
                )}
                <span className="absolute bottom-1.5 left-1.5 rounded bg-white/90 px-1.5 text-caption text-ink-muted">
                  {labels[i]}
                </span>
              </button>
            );
          })}
        </div>
        {picked.length >= MAX_PHOTOS && (
          <p className="mt-2 text-caption text-ink-subtle">
            {MAX_PHOTOS}枚まで選べます。入れ替えるときは、選んだ写真を押して外してください。
          </p>
        )}
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
