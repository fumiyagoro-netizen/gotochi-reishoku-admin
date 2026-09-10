import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { EmptyState } from "./empty-state";
import { Lock } from "./icons";

export type CardPadding = "none" | "sm" | "md";
export type CardTone = "default" | "active";

const PADDING: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-5",
};

export type CardProps = {
  padding?: CardPadding;
  /** overflow-hidden。テーブルを包むときだけ true にする（ポップオーバーを含む面では絶対に付けない） */
  clip?: boolean;
  /** active は award-settings の「受付中」年度の強調 */
  tone?: CardTone;
  as?: "div" | "section";
  className?: string;
  children?: ReactNode;
};

export function Card({
  padding = "md",
  clip = false,
  tone = "default",
  as: Tag = "div",
  className,
  children,
}: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-lg border border-line bg-surface",
        PADDING[padding],
        clip && "overflow-hidden",
        tone === "active" && "border-ink ring-1 ring-ink",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("text-sm font-semibold text-ink", className)}>{children}</h2>;
}

export function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mt-0.5 text-caption text-ink-subtle", className)}>{children}</p>;
}

export type CardHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

/** Card padding="none" の先頭に置く見出し行 */
export function CardHeader({ title, description, actions }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
      <div className="min-w-0">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Card padding="none" の末尾に置く右寄せのボタン行 */
export function CardFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2 rounded-b-lg border-t border-line bg-surface-muted/40 px-5 py-3">
      {children}
    </div>
  );
}

/** 権限なし表示。message は既存 4 文言をそのまま渡す */
export function NoPermission({ message }: { message: string }) {
  return (
    <Card>
      <EmptyState icon={Lock} title={message} />
    </Card>
  );
}
