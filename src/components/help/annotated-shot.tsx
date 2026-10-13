"use client";

import { useRef, useState, type ReactNode } from "react";
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
 * 広い画面では写真を左、説明を右に並べ、説明の欄の高さを写真に揃える（説明が長ければ欄の中だけ
 * スクロールする）。説明を写真の下に置いたり、写真を sticky で追従させたりすると、説明を読み進める
 * うちに写真が画面外へ流れ、光った枠が見えなくなるため。高さを揃えておけば、図が画面に見えている
 * 間は写真と説明が必ず同時に見える。
 * 画面より縦に長い写真（応募者へメール配信・サイドバー）は写真の枠の中だけをスクロールさせ、
 * カーソルを合わせた番号の枠が枠外にあれば、そこまで寄せる。
 * 狭い画面では写真の下に説明を並べる。
 *
 * 注釈の色は印刷物の手引きに倣った朱色で、管理画面のどのトークンとも意味が重ならない
 * ようにしている（warning の琥珀色を流用すると「注意」に読めてしまう）。
 *
 * layout="side" は縦長で幅の狭い写真（サイドバー）用で、写真幅を 15rem に固定する。
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
  const scrollerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const boxRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const side = layout === "side";

  // 写真の枠の中がスクロールできる（縦長の写真）ときだけ、番号の枠が見える位置まで寄せる
  function reveal(n: number) {
    const scroller = scrollerRef.current;
    const frame = frameRef.current;
    const box = boxRefs.current[n];
    if (!scroller || !frame || !box) return;
    if (scroller.scrollHeight <= scroller.clientHeight + 1) return;
    const top = frame.offsetTop + box.offsetTop;
    const bottom = top + box.offsetHeight;
    const viewTop = scroller.scrollTop;
    const viewBottom = viewTop + scroller.clientHeight;
    if (top >= viewTop + 8 && bottom <= viewBottom - 8) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({
      top: Math.max(0, top - (scroller.clientHeight - box.offsetHeight) / 2),
      behavior: reduce ? "auto" : "smooth",
    });
  }

  function activate(n: number) {
    setActive(n);
    reveal(n);
  }

  return (
    <figure
      className={cn(
        "m-0 grid gap-5",
        side ? "sm:grid-cols-[15rem_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)_17rem]",
      )}
    >
      <div
        ref={scrollerRef}
        className={cn(
          "min-w-0 self-start",
          side
            ? "sm:max-h-[calc(100vh-2rem)] sm:overflow-y-auto sm:overscroll-contain"
            : "lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overscroll-contain",
        )}
      >
        <div
          ref={frameRef}
          className="relative overflow-hidden rounded-lg border border-line-strong bg-surface-muted shadow-xs"
        >
          {/* 静的な画面写真なので next/image の最適化は不要（public/help の webp をそのまま出す） */}
          <img src={shot.src} width={shot.width} height={shot.height} alt={alt} className="block h-auto w-full" />
          {shot.callouts.map((c) => (
            <span
              key={c.n}
              ref={(el) => {
                boxRefs.current[c.n] = el;
              }}
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

      {/* h-0 + min-h-full で、この欄は行の高さを押し広げず（行の高さは写真で決まる）、
          写真と同じ高さまで伸びる。収まらない分は欄の中でスクロールする */}
      <div className={cn("min-w-0", side ? "sm:h-0 sm:min-h-full sm:overflow-y-auto" : "lg:h-0 lg:min-h-full lg:overflow-y-auto")}>
        <ol className={cn("grid content-start gap-2", !side && "sm:grid-cols-2 lg:grid-cols-1")}>
          {shot.callouts.map((c, i) => {
            const item = items[i];
            if (!item) return null;
            return (
              <li
                key={c.n}
                tabIndex={0}
                onMouseEnter={() => activate(c.n)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => activate(c.n)}
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
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  {item.unavailable && (
                    <p className="text-caption font-medium text-warning-ink">あなたの権限では使えません</p>
                  )}
                  <p className="mt-0.5 text-caption text-ink-muted">{item.body}</p>
                  <div className="mt-2 flex flex-wrap gap-1">{item.who}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </figure>
  );
}
