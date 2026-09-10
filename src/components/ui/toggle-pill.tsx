import type { MouseEventHandler, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Check, Plus } from "./icons";
import { Spinner } from "./skeleton";

// fetch・state・権限は各 Selector に残す。ここは見た目と aria-pressed だけ。
const BASE =
  "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-sm font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-wait " +
  "[&>svg]:size-3.5 [&>svg]:shrink-0";

// 破線＋薄灰だと「無効」に見えるため、非選択でも文字は ink-muted・hover で黒くする
const UNPRESSED =
  "border-dashed border-line-strong bg-surface text-ink-muted hover:border-ink hover:text-ink";

export type TogglePillProps = {
  pressed: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** 押した1つだけ true にする（呼び出し側: pending={saving && pendingValue === value}） */
  pending?: boolean;
  disabled?: boolean;
  /** pressed 時の完全クラス文字列（*-shared.ts の *_PILL_CLASS） */
  toneClassName?: string;
  /** Trophy など。先頭スロット（Check / Plus / Spinner）の後ろに出る */
  icon?: ReactNode;
  children?: ReactNode;
};

export function TogglePill({
  pressed,
  onClick,
  pending = false,
  disabled,
  toneClassName,
  icon,
  children,
}: TogglePillProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-busy={pending || undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        BASE,
        pressed ? cn("border-solid", toneClassName) : UNPRESSED,
        // 保存中は押した1つ（pending）は薄くせず、他だけ少し落とす
        disabled && !pending && "opacity-60",
      )}
    >
      {/* 先頭スロットを常時描画して Check の付け外しで幅が揺れないようにする */}
      <span className="inline-flex size-3.5 items-center justify-center">
        {pending ? (
          <Spinner size={12} />
        ) : pressed ? (
          <Check className="size-3.5" aria-hidden="true" />
        ) : (
          <Plus className="size-3.5" aria-hidden="true" />
        )}
      </span>
      {icon}
      {children}
    </button>
  );
}
