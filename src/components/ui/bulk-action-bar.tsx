import type { ReactNode } from "react";
import { Button } from "./button";
import { X } from "./icons";

export type BulkActionBarProps = {
  count: number;
  /** 選択解除（右端の X ボタン） */
  onClear: () => void;
  /** サブモードのボタン群。bulkAction の分岐・権限ゲート・fetch は呼び出し側に残す */
  children?: ReactNode;
};

export function BulkActionBar({ count, onClear, children }: BulkActionBarProps) {
  return (
    <div
      role="region"
      aria-label="一括操作"
      className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface shadow-xs px-3 py-2"
    >
      <span className="text-sm font-medium text-ink tabular-nums">{count}件選択中</span>
      <BarDivider />
      {children}
      {/* 「キャンセル」（ghost 文字）と形で区別するため右端にアイコン付きで置く */}
      <Button variant="ghost" size="sm" icon={<X />} className="ml-auto" onClick={onClear}>
        選択解除
      </Button>
    </div>
  );
}

/** 文字の「|」の代わりの区切り線 */
export function BarDivider() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />;
}
