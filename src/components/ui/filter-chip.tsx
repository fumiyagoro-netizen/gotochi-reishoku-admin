import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const BASE =
  "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
const ACTIVE = "border-ink bg-ink text-white";
const INACTIVE = "border-line bg-surface text-ink-muted hover:bg-surface-muted";

type FilterChipCommon = {
  active: boolean;
  children: ReactNode;
  count?: number;
  /** ステータス色は点で示し、チップ自体は塗り分けない */
  dotClassName?: string;
};

export type FilterChipProps = FilterChipCommon &
  ({ href: string; onClick?: never } | { href?: never; onClick: () => void });

/** 絞り込みチップ。href 生成（?action= を空でも付ける等）はページ側のまま渡す */
export function FilterChip({ active, children, count, dotClassName, href, onClick }: FilterChipProps) {
  const className = cn(BASE, active ? ACTIVE : INACTIVE);
  const content = (
    <>
      {dotClassName && <span aria-hidden="true" className={cn("size-2 rounded-full", dotClassName)} />}
      {children}
      {count != null && <span className="text-caption tabular-nums opacity-70">{count}</span>}
    </>
  );

  if (href !== undefined) {
    return (
      <Link href={href} aria-current={active ? "true" : undefined} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-current={active ? "true" : undefined} className={className}>
      {content}
    </button>
  );
}

export function FilterChipGroup({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap gap-1.5">{children}</div>;
}
