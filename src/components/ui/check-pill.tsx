import type { InputHTMLAttributes, ReactNode } from "react";
import { Check } from "./icons";

export type CheckPillProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "className" | "children"
> & {
  children?: ReactNode;
};

/**
 * native checkbox を <label> で包む既存構造を保ったまま checkbox を sr-only にしたピル。
 * 年度／審査状況／受賞枠で色を分けない（選択状態は has-[:checked] だけで示す）。
 */
export function CheckPill({ children, ...props }: CheckPillProps) {
  return (
    <label
      className={
        "relative inline-flex items-center h-8 px-3 rounded-full border border-line-strong bg-surface text-sm text-ink-muted " +
        "cursor-pointer select-none transition-colors hover:bg-surface-muted " +
        "has-[:checked]:border-ink has-[:checked]:text-ink has-[:checked]:bg-surface-muted " +
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40 has-[:disabled]:opacity-50"
      }
    >
      <input type="checkbox" className="peer sr-only" {...props} />
      <Check className="size-3.5 mr-1.5 invisible peer-checked:visible" aria-hidden="true" />
      {children}
    </label>
  );
}
