import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Check } from "./icons";

export type FilterTileProps = {
  href: string;
  active: boolean;
  label: ReactNode;
  count: number;
  /** 賞・審査・到着の hue を小さな点で示す完全クラス文字列（'bg-amber-400' 等） */
  dotClassName?: string;
};

/** 件数付きの絞り込みタイル。href・active 判定はページ側の既存関数をそのまま渡す */
export function FilterTile({ href, active, label, count, dotClassName }: FilterTileProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex h-14 items-center justify-between gap-3 rounded-lg border bg-surface px-4 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        active
          ? "border-ink text-ink ring-1 ring-ink"
          : "border-line text-ink-muted hover:border-line-strong hover:bg-surface-muted/40",
      )}
    >
      <span className="flex items-center gap-1.5 text-sm">
        {dotClassName && <span aria-hidden="true" className={cn("size-2 rounded-full", dotClassName)} />}
        {label}
      </span>
      <span className="flex items-center gap-1.5 text-lg font-semibold tabular-nums">
        {count}
        {active && <Check className="size-4" aria-hidden="true" />}
      </span>
    </Link>
  );
}

export type FilterGroupProps = {
  label: string;
  /** grid はページ側で指定（awards grid-cols-2 md:grid-cols-5 gap-3 / reviews grid-cols-3 gap-3） */
  className?: string;
  children: ReactNode;
};

export function FilterGroup({ label, className, children }: FilterGroupProps) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-1.5 text-caption font-medium text-ink-subtle">{label}</p>
      <div className={className}>{children}</div>
    </div>
  );
}
