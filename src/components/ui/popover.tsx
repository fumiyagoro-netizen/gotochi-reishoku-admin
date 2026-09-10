"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Check } from "./icons";

export type PopoverProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

/**
 * トリガーの下に出るメニュー。親の relative ラッパーは呼び出し側に置く。
 * トリガーには aria-expanded / aria-haspopup="menu" を呼び出し側で付ける。
 */
export function Popover({ open, onClose, children }: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // 「外側」は親ラッパー（トリガーを含む）の外で判定する。パネルだけを内側にすると
    // トリガーの mousedown で閉じた直後に click のトグルで再び開いてしまう
    function onMouseDown(e: globalThis.MouseEvent) {
      const wrapper = panelRef.current?.parentElement;
      if (wrapper && e.target instanceof Node && wrapper.contains(e.target)) return;
      onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="menu"
      className="absolute left-0 top-full mt-1 z-20 min-w-48 rounded-lg border border-line bg-surface shadow-popover p-1"
    >
      {children}
    </div>
  );
}

export type MenuItemProps = {
  selected?: boolean;
  /** 先頭の小さな点（賞色など）。完全クラス文字列を渡す */
  dotClassName?: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
};

export function MenuItem({
  selected,
  dotClassName,
  tone = "default",
  disabled,
  onClick,
  children,
}: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-left transition-colors disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        tone === "danger" ? "text-danger hover:bg-danger-soft" : "text-ink hover:bg-surface-muted",
        selected && "bg-surface-muted font-medium",
      )}
    >
      {dotClassName && <span aria-hidden="true" className={cn("size-2 rounded-full", dotClassName)} />}
      {children}
      {/* 幅固定の Check スロット。選択の有無で項目幅が揺れないようにする */}
      <span className="ml-auto inline-flex size-4">{selected && <Check className="size-4" />}</span>
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-line" />;
}
