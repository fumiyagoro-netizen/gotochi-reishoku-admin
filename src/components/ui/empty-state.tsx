import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Inbox, type LucideIcon } from "./icons";

export type EmptyStateProps = {
  /** lucide のコンポーネント（Trophy / ClipboardList / Users / Receipt / FileText / MessageSquare / Lock） */
  icon?: LucideIcon;
  /** 既存文言をそのまま */
  title: ReactNode;
  /** 既に画面上にある操作を指す一文だけ */
  description?: ReactNode;
  /** 既存と同じ href の ButtonLink だけ */
  action?: ReactNode;
  /** 指定時は <tr><td colSpan> を描画してテーブル内で使う */
  colSpan?: number;
  /** sm はアイコン無し・py-6（コメント欄・モーダル内リスト） */
  size?: "md" | "sm";
};

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  colSpan,
  size = "md",
}: EmptyStateProps) {
  const padding = size === "sm" ? "py-6" : "py-12";
  const body = (
    <>
      {size === "md" && (
        <span className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-surface-muted text-ink-faint">
          <Icon className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </span>
      )}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && (
        <p className="mt-1 text-caption text-ink-subtle max-w-sm mx-auto">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </>
  );

  if (colSpan !== undefined) {
    // 余白は td 側に持たせる（中身に二重に付けない）
    return (
      <tr>
        <td colSpan={colSpan} className={cn("px-4 text-center", padding)}>
          {body}
        </td>
      </tr>
    );
  }

  return <div className={cn("text-center", padding)}>{body}</div>;
}
