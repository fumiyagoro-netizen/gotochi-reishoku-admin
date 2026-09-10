import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
};

export type SegmentedControlProps<T extends string> = {
  value: T;
  /** 選択中の項目を押しても呼ぶ（upload の「押すたびに result をリセット」を既存どおり残すため） */
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
};

/** モード切替（upload の「新規登録 / 一括更新」）。radiogroup として読み上げる */
export function SegmentedControl<T extends string>({ value, onChange, options }: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" className="inline-flex rounded-md bg-surface-muted p-0.5">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-8 rounded-[5px] px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
              selected ? "bg-surface font-medium text-ink shadow-xs" : "text-ink-muted hover:text-ink",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
