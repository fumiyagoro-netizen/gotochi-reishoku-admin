import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Ban, CircleCheck, Package, PackageCheck, Trophy } from "./icons";
import { GRAND_PRIX_BADGE_CLASS, PRIZE_BADGE_CLASS, isPrizeLevel } from "@/lib/prize-shared";
import {
  REVIEW_BADGE_CLASS,
  REVIEW_STATUSES,
  parseReviewStatuses,
} from "@/lib/review-status-shared";
import {
  ITEM_ARRIVAL_BADGE_CLASS,
  ITEM_ARRIVAL_STATUSES,
  parseItemArrivalStatuses,
} from "@/lib/item-arrival-shared";

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "outline"
  | "custom";
export type BadgeSize = "md" | "sm";

const BASE =
  "inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap ring-1 ring-inset " +
  "[&_svg]:size-3.5 [&_svg]:shrink-0";

const SIZE: Record<BadgeSize, string> = {
  md: "h-6 px-2 text-caption",
  sm: "h-5 px-1.5 text-caption",
};

// custom は *-shared.ts の完全クラス文字列を className で受ける
const TONE: Record<Exclude<BadgeTone, "custom">, string> = {
  neutral: "bg-surface-muted text-ink-muted ring-line",
  success: "bg-success-soft text-success-ink ring-success-line",
  warning: "bg-warning-soft text-warning-ink ring-warning-line",
  danger: "bg-danger-soft text-danger-ink ring-danger-line",
  info: "bg-accent-soft text-accent ring-accent-line",
  // 未送信・配信停止・スキップ・追客しない等の「不在」
  outline: "bg-transparent text-ink-subtle ring-line-strong",
};

export type BadgeProps = {
  tone?: BadgeTone;
  size?: BadgeSize;
  /** tone="custom" のときは *-shared.ts の完全クラス文字列。他 tone では追加クラス */
  className?: string;
  /** lucide アイコン（14px に自動調整） */
  icon?: ReactNode;
  /** 先頭の点。"pulse" で受付中のような進行状態を示す */
  dot?: boolean | "pulse";
  title?: string;
  children?: ReactNode;
};

export function Badge({
  tone = "neutral",
  size = "md",
  className,
  icon,
  dot,
  title,
  children,
}: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(BASE, SIZE[size], tone !== "custom" && TONE[tone], className)}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full bg-current", dot === "pulse" && "animate-pulse")}
        />
      )}
      {icon}
      {children}
    </span>
  );
}

/* ---- ドメイン別ラッパー。空なら null、未知値はスキップ（旧 selector 内の実装と同じ約束） ---- */

export function PrizeBadge({ prizeLevel, size }: { prizeLevel: string; size?: BadgeSize }) {
  if (!prizeLevel) return null;
  if (!isPrizeLevel(prizeLevel)) return null;
  return (
    <Badge tone="custom" size={size} className={PRIZE_BADGE_CLASS[prizeLevel]} icon={<Trophy />}>
      {prizeLevel}
    </Badge>
  );
}

/** グランプリ（称号）。受賞バッジの横に並べる */
export function GrandPrixBadge({ size }: { size?: BadgeSize }) {
  return (
    <Badge tone="custom" size={size} className={GRAND_PRIX_BADGE_CLASS} icon={<Trophy />}>
      グランプリ
    </Badge>
  );
}

export function ReviewBadge({ status, size }: { status: string; size?: BadgeSize }) {
  const active = parseReviewStatuses(status);
  if (active.length === 0) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {active.map((s) => {
        const rs = REVIEW_STATUSES.find((r) => r.value === s);
        if (!rs) return null;
        return (
          <Badge
            key={s}
            tone="custom"
            size={size}
            className={REVIEW_BADGE_CLASS[rs.value]}
            icon={rs.value === "rejected" ? <Ban /> : <CircleCheck />}
          >
            {rs.label}
          </Badge>
        );
      })}
    </div>
  );
}

// フォームの状態。文言・色は src/app/forms/page.tsx の定義を正として写したもの
const FORM_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "下書き", tone: "neutral" },
  published: { label: "公開", tone: "success" },
  closed: { label: "受付終了", tone: "warning" },
};

/** forms 一覧・詳細の状態バッジ。未知の状態は neutral ＋ 生文字列 */
export function FormStatusBadge({ status, size }: { status: string; size?: BadgeSize }) {
  const meta = Object.prototype.hasOwnProperty.call(FORM_STATUS, status) ? FORM_STATUS[status] : undefined;
  return (
    <Badge tone={meta?.tone ?? "neutral"} size={size}>
      {meta?.label ?? status}
    </Badge>
  );
}

export function ItemArrivalBadge({ status, size }: { status: string; size?: BadgeSize }) {
  const active = parseItemArrivalStatuses(status);
  if (active.length === 0) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {active.map((s) => {
        const rs = ITEM_ARRIVAL_STATUSES.find((r) => r.value === s);
        if (!rs) return null;
        return (
          <Badge
            key={s}
            tone="custom"
            size={size}
            className={ITEM_ARRIVAL_BADGE_CLASS[rs.value]}
            icon={rs.value === "final_arrived" ? <PackageCheck /> : <Package />}
          >
            {rs.label}
          </Badge>
        );
      })}
    </div>
  );
}
