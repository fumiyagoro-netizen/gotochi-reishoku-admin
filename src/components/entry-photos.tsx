"use client";

import { useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InlineConfirm } from "@/components/ui/inline-confirm";
import { Download, Loader2, Plus } from "@/components/ui/icons";
import {
  ENTRY_PHOTO_MAX_BYTES,
  ENTRY_PHOTO_TYPES,
  MAX_ENTRY_PHOTOS,
  type EntryPhoto,
} from "@/lib/entry-photos-shared";

/**
 * エントリー詳細の「商品写真」の中身。管理者（canEdit）は差し替え・追加・削除・メインにするができ、
 * 押したその場で保存する（受賞や審査状況のセレクタと同じく「編集」ボタンとは別）。
 */
export function EntryPhotos({
  entryId,
  images,
  onChange,
  canEdit,
  canDownload,
}: {
  entryId: number;
  images: EntryPhoto[];
  onChange: (images: EntryPhoto[]) => void;
  canEdit: boolean;
  canDownload: boolean;
}) {
  // 写真を選ぶ欄は1つを使い回す。どの写真の差し替えか（null なら追加）を覚えておく
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceIdRef = useRef<number | null>(null);
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const busy = busyId !== null;
  const canAdd = canEdit && images.length < MAX_ENTRY_PHOTOS;
  let subIndex = 0;

  function pick(replaceId: number | null) {
    replaceIdRef.current = replaceId;
    setError("");
    inputRef.current?.click();
  }

  async function send(res: Promise<Response>) {
    const data = await (await res).json();
    if (!data.success) throw new Error(data.message || "写真を変更できませんでした");
    onChange(data.images);
  }

  async function upload(file: File, replaceId: number | null) {
    setError("");
    setConfirmingId(null);
    setBusyId(replaceId ?? "new");
    try {
      const fd = new FormData();
      fd.append("file", await prepareFile(file));
      if (replaceId !== null) fd.append("replaceId", String(replaceId));
      await send(fetch(`/api/entries/${entryId}/images`, { method: "POST", body: fd }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "写真をアップロードできませんでした");
    } finally {
      setBusyId(null);
    }
  }

  async function makeMain(id: number) {
    setError("");
    setBusyId(id);
    try {
      await send(
        fetch(`/api/entries/${entryId}/images/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ main: true }),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "写真を変更できませんでした");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number) {
    setError("");
    setBusyId(id);
    try {
      await send(fetch(`/api/entries/${entryId}/images/${id}`, { method: "DELETE" }));
      setConfirmingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "写真を削除できませんでした");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}
      {images.length === 0 && !canEdit && <p className="text-sm text-ink-subtle">写真はありません。</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((img) => {
          const isMain = img.imageType === "main";
          const label = isMain ? "メインビジュアル" : `サブ画像 ${++subIndex}`;
          return (
            <div key={img.id}>
              <div className="relative">
                <img
                  src={`/api/images/${img.id}`}
                  alt={label}
                  className="w-full aspect-square object-cover rounded-md border border-line bg-surface-muted"
                />
                {busyId === img.id && <BusyOverlay />}
              </div>
              <div className="flex items-center justify-center gap-3 mt-1.5">
                <p className="text-caption text-ink-subtle">{label}</p>
                {canDownload && <ImageDownloadLink href={`/api/images/${img.id}?download=1`} />}
              </div>
              {canEdit &&
                (confirmingId === img.id ? (
                  <InlineConfirm
                    message={isMain && images.length > 1 ? "削除すると、次のサブ画像がメインになります。" : "この写真を削除しますか？"}
                    confirmLabel="削除する"
                    loadingLabel="削除中..."
                    loading={busyId === img.id}
                    onConfirm={() => remove(img.id)}
                    onCancel={() => setConfirmingId(null)}
                    className="mt-2"
                  />
                ) : (
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                    <Button variant="link" size="sm" onClick={() => pick(img.id)} disabled={busy}>
                      差し替え
                    </Button>
                    {!isMain && (
                      <Button variant="link" size="sm" onClick={() => makeMain(img.id)} disabled={busy}>
                        メインにする
                      </Button>
                    )}
                    <Button variant="linkDanger" size="sm" onClick={() => setConfirmingId(img.id)} disabled={busy}>
                      削除
                    </Button>
                  </div>
                ))}
            </div>
          );
        })}

        {canAdd && (
          <div>
            <button
              type="button"
              onClick={() => pick(null)}
              disabled={busy}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file && !busy) upload(file, null);
              }}
              className={`relative flex w-full aspect-square flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed text-ink-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60 ${
                dragOver ? "border-accent bg-accent/5 text-accent" : "border-line-strong"
              }`}
            >
              <Plus className="size-6" aria-hidden="true" />
              <span className="text-sm font-medium">{images.length === 0 ? "メインビジュアルを追加" : "写真を追加"}</span>
              <span className="text-caption text-ink-subtle">クリックか、ここへドロップ</span>
              {busyId === "new" && <BusyOverlay />}
            </button>
          </div>
        )}
      </div>

      {canEdit && (
        <p className="text-caption text-ink-faint">
          JPEG・PNG・WebP、{MAX_ENTRY_PHOTOS}枚まで。4MBを超える写真は縮めて保存します。押したその場で保存され、操作ログに残ります。公開サイトに出している写真を差し替えると、サイトの写真も新しいものに変わります。
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) upload(file, replaceIdRef.current);
        }}
      />
    </div>
  );
}

function BusyOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-md bg-surface/70">
      <Loader2 className="size-6 animate-spin text-ink-muted" aria-label="保存中" />
    </div>
  );
}

/** 商品写真の「ダウンロード」。<a download> のまま（要素種を変えない） */
function ImageDownloadLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      download
      className="inline-flex items-center gap-1 rounded-sm text-caption text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <Download className="size-3.5" aria-hidden="true" />
      ダウンロード
    </a>
  );
}

/**
 * そのまま送れる写真はそのまま（元の画質を保つ）。4MB を超える写真や、ブラウザが読めるが
 * サーバーが受け付けない形式（Safari での HEIC など）は、JPEG に縮めてから送る。
 */
async function prepareFile(file: File): Promise<File> {
  if (ENTRY_PHOTO_TYPES.includes(file.type) && file.size <= ENTRY_PHOTO_MAX_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("この写真は読み込めません。JPEG・PNG・WebP で保存し直してから選んでください");
  }
  try {
    for (const [edge, quality] of [[4000, 0.9], [3000, 0.88], [2400, 0.85], [1800, 0.82]]) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      // 透過のある PNG は JPEG にすると黒くなるので、白を敷いてから描く
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= ENTRY_PHOTO_MAX_BYTES) {
        return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      }
    }
  } finally {
    bitmap.close();
  }
  throw new Error("写真が大きすぎます。4MB以下にしてから選んでください");
}
