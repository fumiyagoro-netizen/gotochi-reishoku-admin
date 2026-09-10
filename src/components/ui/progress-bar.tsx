import { cn } from "@/lib/cn";

export type ProgressBarProps = {
  /** バーの幅（%）。Math.max(…, 8) の下限は呼び出し側で維持する */
  percent: number;
  label: string;
  value: number;
  /** 塗りの完全クラス文字列。賞は PRIZE_BAR_CLASS を渡す */
  fillClassName?: string;
};

/** 件数をバーの外に出し、細い幅でも見切れないようにした横棒 */
export function ProgressBar({ percent, label, value, fillClassName = "bg-ink/70" }: ProgressBarProps) {
  return (
    <div className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3">
      <span className="text-sm text-ink-muted truncate" title={label}>
        {label}
      </span>
      <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
        <div className={cn("h-full rounded-full", fillClassName)} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-sm tabular-nums text-right text-ink">{value}</span>
    </div>
  );
}
