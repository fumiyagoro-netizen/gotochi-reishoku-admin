"use client";

import {
  useEffect,
  useId,
  useRef,
  type FormEventHandler,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "@/lib/cn";

export type ModalSize = "sm" | "md" | "lg" | "xl";

const SIZE: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  /** 背景クリックで閉じる。既存で背景クリック閉じがある画面（invoices/items・prospects）だけ true */
  closeOnBackdrop?: boolean;
  /** Esc で閉じる。既定は closeOnBackdrop と同じ（背景で閉じる＝Esc でも閉じる、の1ルール） */
  closeOnEsc?: boolean;
  /** "form" にするとパネル自体が <form> になり、footer の type="submit" と required 検証がそのまま効く */
  as?: "div" | "form";
  onSubmit?: FormEventHandler<HTMLFormElement>;
  /** フッタ右（主ボタン） */
  footer?: ReactNode;
  /** フッタ左（削除・閉じる・InlineConfirm） */
  footerStart?: ReactNode;
  /** 開いたときにフォーカスする要素。既定は最初の入力欄 */
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  closeOnBackdrop = false,
  closeOnEsc,
  as = "div",
  onSubmit,
  footer,
  footerStart,
  initialFocusRef,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const escEnabled = closeOnEsc ?? closeOnBackdrop;

  // 開いている間は背景のスクロールを止め、閉じたら開く前にフォーカスがあった要素（起点ボタン）へ戻す
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const target =
      initialFocusRef?.current ??
      panelRef.current?.querySelector<HTMLElement>(
        "input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])",
      ) ??
      panelRef.current;
    target?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [open, initialFocusRef]);

  useEffect(() => {
    if (!open || !escEnabled) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, escEnabled, onClose]);

  if (!open) return null;

  function handleBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (closeOnBackdrop && e.target === e.currentTarget) onClose();
  }

  const setPanel = (el: HTMLElement | null) => {
    panelRef.current = el;
  };

  const panelProps = {
    ref: setPanel,
    role: "dialog" as const,
    "aria-modal": true,
    "aria-labelledby": titleId,
    tabIndex: -1,
    className: cn(
      "bg-surface rounded-xl border border-line shadow-modal w-full flex flex-col max-h-[90vh]",
      "focus:outline-none",
      SIZE[size],
    ),
  };

  const inner = (
    <>
      <div className="px-6 pt-6 pb-2">
        <h2 id={titleId} className="text-base font-semibold text-ink">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      <div className="px-6 py-4 space-y-5 overflow-y-auto min-h-0 flex-1">{children}</div>
      {(footer || footerStart) && <ModalFooter start={footerStart}>{footer}</ModalFooter>}
    </>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 px-4"
      onClick={handleBackdropClick}
    >
      {as === "form" ? (
        <form {...panelProps} onSubmit={onSubmit}>
          {inner}
        </form>
      ) : (
        <div {...panelProps}>{inner}</div>
      )}
    </div>
  );
}

/** モーダル下部の固定フッタ。start は左（削除・閉じる）、children は右（主ボタン） */
export function ModalFooter({ start, children }: { start?: ReactNode; children?: ReactNode }) {
  return (
    <div className="px-6 py-4 border-t border-line flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">{start}</div>
      <div className="flex items-center justify-end gap-2">{children}</div>
    </div>
  );
}
