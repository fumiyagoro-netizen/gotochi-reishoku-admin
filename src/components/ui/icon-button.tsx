import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";

export type IconButtonSize = "sm" | "md";
export type IconButtonTone = "neutral" | "danger";

const BASE =
  "inline-flex items-center justify-center rounded-md text-ink-subtle transition-colors " +
  "disabled:opacity-40 disabled:cursor-not-allowed " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 [&_svg]:size-4 [&_svg]:shrink-0";

const SIZE: Record<IconButtonSize, string> = {
  sm: "size-7",
  md: "size-8",
};

// hover 色は tone ごとに持つ（同じ hover: 変数を base と tone で重ねると CSS の出力順に依存するため）
const TONE: Record<IconButtonTone, string> = {
  neutral: "hover:bg-surface-muted hover:text-ink",
  danger: "hover:bg-danger-soft hover:text-danger",
};

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  /** aria-label と title の両方に入れる（『上へ』『下へ』『削除』など既存 title をそのまま渡す） */
  label: string;
  /** lucide アイコン（16px に自動調整） */
  icon: ReactNode;
  size?: IconButtonSize;
  tone?: IconButtonTone;
  ref?: Ref<HTMLButtonElement>;
};

/** アイコンだけのボタン。form 内の並べ替え・行削除で使うので type の既定は "button" */
export function IconButton({
  label,
  icon,
  size = "md",
  tone = "neutral",
  type = "button",
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(BASE, SIZE[size], TONE[tone], className)}
      {...rest}
    >
      {icon}
    </button>
  );
}
