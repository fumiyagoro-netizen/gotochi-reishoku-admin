"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { HelpShot } from "@/lib/help-shots";

export type AnnotatedItem = {
  title: string;
  body: string;
  /** 使える権限のバッジなど */
  who: ReactNode;
  /** 見ている人の権限では使えない項目。薄く表示して「使えません」と添える */
  unavailable?: boolean;
};

/**
 * 番号付きの枠を重ねた画面写真と、番号ごとの説明。
 * 説明にカーソル（またはフォーカス）を合わせると、画面上の同じ番号の枠が光る。
 * client component なのはこの連動のためだけ。
 *
 * 注釈の色は印刷物の手引きに倣った朱色で、管理画面のどのトークンとも意味が重ならない
 * ようにしている（warning の琥珀色を流用すると「注意」に読めてしまう）。
 *
 * layout="side" は縦長の写真（サイドバー）用で、写真を左、説明を右に1列で並べる。
 */
export function AnnotatedShot({
  shot,
  alt,
  items,
  note,
  layout = "stack",
}: {
  shot: HelpShot;
  alt: string;
  items: AnnotatedItem[];
  /** 写真の下に出す注記（架空の値に置き換えた項目など） */
  note?: string;
  layout?: "stack" | "side";
}) {
  const [active, setActive] = useState<number | null>(null);
  const side = layout === "side";

  return (
    <figure className={cn("m-0", side && "grid gap-5 sm:grid-cols-[15rem_minmax(0,1fr)] sm:items-start")}>
      <div className="min-w-0">
        <div className="relative overflow-hidden rounded-lg border border-line-strong bg-surface-muted shadow-xs">
          {/* 静的な画面写真なので next/image の最適化は不要（public/help の webp をそのまま出す） */}
          <img src={shot.src} width={shot.width} height={shot.height} alt={alt} className="block h-auto w-full" />
          {shot.callouts.map((c) => (
            <span
              key={c.n}
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute rounded-md border-2 border-orange-600 transition-colors",
                active === c.n && "bg-orange-500/10 ring-4 ring-orange-500/20",
              )}
              style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%` }}
            >
              <span className="absolute -left-2.5 -top-2.5 grid size-5 place-items-center rounded-full bg-orange-600 text-caption font-semibold leading-none text-white ring-2 ring-white">
                {c.n}
              </span>
            </span>
          ))}
        </div>
        {note && <figcaption className="mt-2 text-caption text-ink-faint">{note}</figcaption>}
      </div>

      <ol className={cn("grid gap-2", side ? "content-start" : "mt-4 sm:grid-cols-2")}>
        {shot.callouts.map((c, i) => {
          const item = items[i];
          if (!item) return null;
          return (
            <li
              key={c.n}
              tabIndex={0}
              onMouseEnter={() => setActive(c.n)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(c.n)}
              onBlur={() => setActive(null)}
              className={cn(
                "flex min-w-0 gap-3 rounded-lg border bg-surface p-3 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                active === c.n ? "border-orange-600" : "border-line",
                item.unavailable && "opacity-50",
              )}
            >
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-orange-600 text-caption font-semibold leading-none text-white">
                {c.n}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  {item.title}
                  {item.unavailable && (
                    <span className="ml-2 text-caption font-medium text-warning-ink">あなたの権限では使えません</span>
                  )}
                </p>
                <p className="mt-0.5 text-caption text-ink-muted">{item.body}</p>
                <div className="mt-2 flex flex-wrap gap-1">{item.who}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
