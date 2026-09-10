import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button, ButtonLink, buttonClassName } from "./button";
import { ChevronLeft, ChevronRight } from "./icons";

export type PaginationProps = {
  page: number;
  totalPages: number;
  /** Link 版。既存の手組み href（q・category・year 等の引き継ぎ）をそのまま関数にして渡す */
  hrefFor?: (page: number) => string;
  /** button 版（invoices の setPage） */
  onChange?: (page: number) => void;
  /** total と pageSize の両方があれば左に「{from}–{to} / {total}件」を出す */
  total?: number;
  pageSize?: number;
};

export function Pagination({ page, totalPages, hrefFor, onChange, total, pageSize }: PaginationProps) {
  if (totalPages <= 1) return null;

  const range =
    total !== undefined && pageSize !== undefined
      ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} / ${total}件`
      : null;

  return (
    <nav aria-label="ページ送り" className="mt-4 flex items-center justify-between">
      <p className="text-caption text-ink-subtle tabular-nums">{range}</p>
      <div className="flex items-center gap-1">
        <PageStep
          target={page - 1}
          disabled={page <= 1}
          hrefFor={hrefFor}
          onChange={onChange}
          icon={<ChevronLeft />}
        >
          前へ
        </PageStep>
        <span className="px-2 text-sm tabular-nums text-ink-muted">
          {page} / {totalPages}
        </span>
        <PageStep
          target={page + 1}
          disabled={page >= totalPages}
          hrefFor={hrefFor}
          onChange={onChange}
          iconRight={<ChevronRight />}
        >
          次へ
        </PageStep>
      </div>
    </nav>
  );
}

// 端では要素を消さず disabled で描画し、中央の「n / N」の位置を固定する
function PageStep({
  target,
  disabled,
  hrefFor,
  onChange,
  icon,
  iconRight,
  children,
}: {
  target: number;
  disabled: boolean;
  hrefFor?: (page: number) => string;
  onChange?: (page: number) => void;
  icon?: ReactNode;
  iconRight?: ReactNode;
  children: ReactNode;
}) {
  if (hrefFor) {
    if (disabled) {
      return (
        <span
          aria-disabled="true"
          className={cn(
            buttonClassName({ variant: "secondary", size: "sm" }),
            "opacity-50 cursor-not-allowed",
          )}
        >
          {icon}
          {children}
          {iconRight}
        </span>
      );
    }
    return (
      <ButtonLink
        variant="secondary"
        size="sm"
        href={hrefFor(target)}
        icon={icon}
        iconRight={iconRight}
      >
        {children}
      </ButtonLink>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      icon={icon}
      iconRight={iconRight}
      disabled={disabled}
      onClick={() => onChange?.(target)}
    >
      {children}
    </Button>
  );
}
