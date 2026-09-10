import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ArrowLeft } from "./icons";

export type PageWidth = "list" | "form" | "detail";

const WIDTH: Record<PageWidth, string> = {
  list: "max-w-page",
  form: "max-w-3xl",
  detail: "max-w-5xl",
};

/** ページ全体の余白と最大幅。一覧 = list、入力フォーム = form、詳細 = detail */
export function PageContainer({ width = "list", children }: { width?: PageWidth; children: ReactNode }) {
  return <div className={cn("w-full min-w-0 px-8 py-6", WIDTH[width])}>{children}</div>;
}

export type BackLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

/** 見出しの真上に置く戻りリンク（href・文言は既存値をそのまま渡す） */
export function BackLink({ href, className, children }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1 rounded-md text-caption text-ink-subtle transition-colors hover:text-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        className,
      )}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {children}
    </Link>
  );
}

export type PageHeaderProps = {
  title: ReactNode;
  count?: number;
  /** 件数の単位。users は「名」、email-logs は「件の配信」 */
  countUnit?: string;
  /** 年度 Badge など。count の前に置く */
  meta?: ReactNode;
  description?: string;
  backHref?: string;
  backLabel?: string;
  /** 右端のボタン列。右端が primary 1 つ、左へ secondary → ghost の順で渡す */
  actions?: ReactNode;
  /** ツールバー行（検索フォーム等） */
  children?: ReactNode;
};

export function PageHeader({
  title,
  count,
  countUnit = "件",
  meta,
  description,
  backHref,
  backLabel,
  actions,
  children,
}: PageHeaderProps) {
  return (
    <div className="mb-6">
      {backHref && (
        <BackLink href={backHref} className="mb-2">
          {backLabel ?? "戻る"}
        </BackLink>
      )}
      <div className="flex items-start justify-between gap-4">
        {/* 見出し側を flex-1（basis 0）にすると、余った幅は見出しが取り、actions は自分の幅がページ幅を
            超えたときだけ縮んで折り返す。長い件名（email-logs 明細）は従来どおり先に truncate される */}
        <div className="min-w-0 flex-1">
          <h1 className="flex min-w-0 items-baseline gap-2 text-xl font-semibold tracking-tight text-ink">
            {/* 長い件名（email-logs 明細）は切って title で全文を確認できるようにする */}
            <span className="truncate" title={typeof title === "string" ? title : undefined}>
              {title}
            </span>
            {meta}
            {count != null && (
              <span className="shrink-0 text-sm font-normal tabular-nums text-ink-subtle">
                {count}
                {countUnit}
              </span>
            )}
          </h1>
          {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
