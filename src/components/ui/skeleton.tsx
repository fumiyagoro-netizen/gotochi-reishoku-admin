import { cn } from "@/lib/cn";
import { Card } from "./card";
import { Loader2 } from "./icons";

/** 回転アイコン＋読み上げ用テキスト。ボタン内では [&_svg]:size-4 が効くので size は TogglePill 等の 12px 枠向け */
export function Spinner({ size = 16 }: { size?: 12 | 16 }) {
  return (
    <>
      <Loader2
        className={cn("shrink-0 animate-spin text-current", size === 12 ? "size-3" : "size-4")}
        aria-hidden="true"
      />
      <span className="sr-only">読み込み中</span>
    </>
  );
}

/** 幅・高さは className で渡す（h-3.5 w-1/2 など） */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-surface-sunken", className)} />;
}

// セル幅は 3 種を巡回させて「表っぽさ」を出す
const CELL_WIDTHS = ["w-1/3", "w-1/2", "w-2/3"] as const;

export type TableSkeletonProps = {
  rows?: number;
  cols: number;
  /** 先頭にサムネ枠（size-10）を置く。行高も実際のサムネ付き行（56px）に合わせる */
  thumb?: boolean;
};

/** 表の形をした読み込み中表示。既存の「読み込み中...」文言は sr-only で残す */
export function TableSkeleton({ rows = 8, cols, thumb = false }: TableSkeletonProps) {
  return (
    <div aria-busy="true">
      <span className="sr-only">読み込み中...</span>
      <Card padding="none" clip>
        <div className="h-9 border-b border-line bg-surface-muted/60" />
        {Array.from({ length: rows }, (_, r) => (
          <div
            key={r}
            className={cn(
              "flex items-center gap-4 border-b border-line px-4 last:border-0",
              thumb ? "h-14" : "h-10",
            )}
          >
            {thumb && <Skeleton className="size-10 shrink-0" />}
            {Array.from({ length: cols }, (_, c) => (
              <Skeleton key={c} className={cn("h-3.5", CELL_WIDTHS[c % CELL_WIDTHS.length])} />
            ))}
          </div>
        ))}
      </Card>
    </div>
  );
}

const LINE_WIDTHS = ["w-full", "w-5/6", "w-2/3"] as const;

/** カードの形をした読み込み中表示（見出し1本＋本文 lines 本） */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div aria-busy="true">
      <span className="sr-only">読み込み中...</span>
      <Card>
        <Skeleton className="h-4 w-40" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: lines }, (_, i) => (
            <Skeleton key={i} className={cn("h-3.5", LINE_WIDTHS[i % LINE_WIDTHS.length])} />
          ))}
        </div>
      </Card>
    </div>
  );
}
