"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field-controls";
import { ImageIcon } from "@/components/ui/icons";
import { siteAssetSrc } from "@/lib/site-collections-shared";
import { newsImageLine, newsImages, updateNewsImage } from "@/lib/news-body";
import { uploadSiteFile } from "./site-image-field";

/**
 * お知らせの本文。文字の入力欄に「画像を挿入」を付けたもの（書き方は src/lib/news-body.ts）。
 * 画像はカーソルのある行のすぐ下に [画像:…] の行として入る。下の一覧で画像ごとに説明を付けたり外したりできる。
 */
export function NewsBodyField({
  id,
  value,
  rows = 12,
  onChange,
}: {
  id: string;
  value: string;
  rows?: number;
  onChange: (v: string) => void;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const images = newsImages(value);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    // 選ぶ前のカーソル位置（アップロード中に入力が変わっても、押したときの行に入れる）
    const cursor = textarea.current?.selectionStart ?? value.length;
    setBusy(true);
    setError("");
    try {
      const lines: string[] = [];
      for (const f of files) lines.push(newsImageLine(await uploadSiteFile("news", f)));
      // カーソルのある行の終わりに改行して、画像の行を入れる（行の途中で文章を割らない）
      const end = value.indexOf("\n", cursor);
      const at = end === -1 ? value.length : end;
      const head = value.slice(0, at);
      const insert = (head ? "\n" : "") + lines.join("\n");
      const next = head + insert + value.slice(at);
      onChange(next);
      requestAnimationFrame(() => {
        const el = textarea.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(at + insert.length, at + insert.length);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label
          className={
            "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-caption font-medium text-ink shadow-xs " +
            "hover:bg-surface-muted focus-within:ring-2 focus-within:ring-accent/40" +
            (busy ? " pointer-events-none opacity-50" : "")
          }
        >
          <ImageIcon className="size-4" aria-hidden="true" />
          {busy ? "アップロード中…" : "画像を挿入"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="sr-only"
            disabled={busy}
            onChange={onFile}
          />
        </label>
        <span className="text-caption text-ink-subtle">カーソルのある行の下に入ります（1枚4MBまで）</span>
      </div>
      <Textarea ref={textarea} id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      {error && <p className="text-caption text-danger-ink">{error}</p>}
      {images.length > 0 && (
        <div className="space-y-2 rounded-md border border-line p-3">
          <p className="text-caption font-medium text-ink-subtle">本文の画像（上から順に {images.length}枚）</p>
          {images.map((img, i) => (
            <div key={`${img.url}-${i}`} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={siteAssetSrc(img.url, 320)} alt="" className="size-14 shrink-0 rounded-md border border-line object-cover" />
              <Input
                value={img.caption}
                placeholder="画像の説明（任意。画像の下に小さく出ます）"
                onChange={(e) => onChange(updateNewsImage(value, i, { caption: e.target.value }))}
              />
              <Button variant="linkDanger" size="sm" onClick={() => onChange(updateNewsImage(value, i, null))}>
                外す
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
