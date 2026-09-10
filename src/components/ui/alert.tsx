import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "./icons";

export type AlertTone = "info" | "success" | "warning" | "danger";

const BASE =
  "flex gap-3 rounded-lg border px-4 break-words [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:mt-0.5";

const TONE: Record<AlertTone, string> = {
  info: "bg-info-soft border-info-line text-info-ink",
  success: "bg-success-soft border-success-line text-success-ink",
  warning: "bg-warning-soft border-warning-line text-warning-ink",
  danger: "bg-danger-soft border-danger-line text-danger-ink",
};

const DEFAULT_ICON: Record<AlertTone, ReactNode> = {
  info: <Info aria-hidden="true" />,
  success: <CircleCheck aria-hidden="true" />,
  warning: <TriangleAlert aria-hidden="true" />,
  danger: <CircleAlert aria-hidden="true" />,
};

export type AlertProps = {
  tone: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  /** 既定は tone ごとのアイコン。null で非表示 */
  icon?: ReactNode;
  /** 右端の導線（住所未設定 → 設定画面の Link など） */
  action?: ReactNode;
  /** フィルタ枠内・モーダル内の一段小さい版 */
  compact?: boolean;
};

export function Alert({ tone, title, children, icon, action, compact }: AlertProps) {
  return (
    <div
      // 失敗だけ即時読み上げ、他は丁寧な通知
      role={tone === "danger" ? "alert" : "status"}
      className={cn(BASE, compact ? "py-2 text-caption" : "py-3 text-sm", TONE[tone])}
    >
      {icon === undefined ? DEFAULT_ICON[tone] : icon}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
