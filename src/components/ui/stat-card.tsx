import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Card } from "./card";
import { ArrowUpRight } from "./icons";

export type StatTone = "default" | "danger" | "warning" | "success" | "purple";

// 数値の色だけを変える（>0 のような条件は呼び出し側で判定して tone を渡す）
const VALUE_TONE: Record<StatTone, string> = {
  default: "text-ink",
  danger: "text-danger",
  warning: "text-warning-ink",
  success: "text-success-ink",
  purple: "text-purple-600",
};

export type StatCardProps = {
  label: ReactNode;
  value: number | string;
  hint?: ReactNode;
  /** 指定すると Link で包み、右上に ArrowUpRight を出す */
  href?: string;
  tone?: StatTone;
};

export function StatCard({ label, value, hint, href, tone = "default" }: StatCardProps) {
  const body = (
    <Card
      padding="sm"
      className={cn(
        "relative",
        href && "transition-colors hover:border-line-strong hover:bg-surface-muted/40",
      )}
    >
      <p className="text-caption font-medium text-ink-subtle">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tracking-tight tabular-nums", VALUE_TONE[tone])}>
        {value}
      </p>
      {hint && <p className="mt-1 text-caption text-ink-subtle">{hint}</p>}
      {href && (
        <ArrowUpRight
          className="absolute right-4 top-4 size-4 text-ink-faint group-hover:text-accent"
          aria-hidden="true"
        />
      )}
    </Card>
  );

  if (!href) return body;

  return (
    <Link
      href={href}
      className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {body}
    </Link>
  );
}
