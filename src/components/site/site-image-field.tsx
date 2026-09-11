"use client";

import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { FileInput } from "@/components/ui/field-controls";
import { ImageOff } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { SITE_UPLOAD_MAX_BYTES, type SiteUploadKind } from "@/lib/site-collections-shared";

// サイト管理の画像・PDF の入力欄。選んだ時点で /api/site/upload に上げ、返ってきた URL を値にする。
// 保存（作成・更新）するまでは行に紐づかない。差し替え・削除で使わなくなったものはサーバーが消す

export async function uploadSiteFile(kind: SiteUploadKind, file: File): Promise<string> {
  if (file.size > SITE_UPLOAD_MAX_BYTES) throw new Error("ファイルは4MBまでです");
  const fd = new FormData();
  fd.append("kind", kind);
  fd.append("file", file);
  const res = await fetch("/api/site/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.message || "アップロードに失敗しました");
  return data.url as string;
}

function Preview({ url, contain }: { url: string; contain?: boolean }) {
  if (!url) {
    return (
      <span className="grid size-16 shrink-0 place-items-center rounded-md bg-surface-muted text-ink-faint">
        <ImageOff className="size-5" aria-hidden="true" />
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className={cn("size-16 shrink-0 rounded-md border border-line bg-surface", contain ? "object-contain p-1" : "object-cover")}
    />
  );
}

/** 画像1枚（審査員の写真・ロゴ）。contain はロゴ用（切り抜かずに収める） */
export function ImageField({
  kind,
  value,
  onChange,
  contain,
}: {
  kind: SiteUploadKind;
  value: string;
  onChange: (url: string) => void;
  contain?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await uploadSiteFile(kind, file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-3">
      <Preview url={value} contain={contain} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <FileInput accept="image/png,image/jpeg,image/webp,image/gif" hint={busy ? "アップロード中…" : "4MBまで"} disabled={busy} onChange={onFile} />
        {value && (
          <Button variant="linkDanger" size="sm" onClick={() => onChange("")}>
            外す
          </Button>
        )}
        {error && <p className="text-caption text-danger-ink">{error}</p>}
      </div>
    </div>
  );
}

/** 画像を複数（受賞者の声の写真）。並び順どおりに表示される */
export function ImagesField({
  kind,
  max,
  value,
  onChange,
}: {
  kind: SiteUploadKind;
  max: number;
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, max - value.length);
    e.target.value = "";
    if (files.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const urls: string[] = [];
      for (const f of files) urls.push(await uploadSiteFile(kind, f));
      onChange([...value, ...urls]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {value.map((url, i) => (
            <div key={url} className="space-y-1">
              <Preview url={url} />
              <Button variant="linkDanger" size="sm" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                外す
              </Button>
            </div>
          ))}
        </div>
      )}
      {value.length < max && (
        <FileInput
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          hint={busy ? "アップロード中…" : `あと${max - value.length}枚・1枚4MBまで`}
          disabled={busy}
          onChange={onFile}
        />
      )}
      {error && <p className="text-caption text-danger-ink">{error}</p>}
    </div>
  );
}
