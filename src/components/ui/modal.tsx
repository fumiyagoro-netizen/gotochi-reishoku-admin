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
  /** ボタン行の上に全幅で出す確認文（ModalFooter の note） */
  footerNote?: ReactNode;
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
  footerNote,
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
      {(footer || footerStart || footerNote) && (
        <ModalFooter start={footerStart} note={footerNote}>
          {footer}
        </ModalFooter>
      )}
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

export type ModalFooterProps = {
  /** 左（削除・閉じる・InlineConfirm） */
  start?: ReactNode;
  /** ボタン行の上に全幅で出す確認文（「この操作は取り消せません」等）。Alert compact も置ける */
  note?: ReactNode;
  /** 右（主ボタン） */
  children?: ReactNode;
};

/** モーダル下部の固定フッタ。start は左（削除・閉じる）、children は右（主ボタン） */
export function ModalFooter({ start, note, children }: ModalFooterProps) {
  return (
    <div className="px-6 py-4 border-t border-line flex flex-wrap items-center justify-between gap-2">
      {/* note は basis-full で 1 行目を占め、ボタン列を 2 行目へ送る */}
      {note && <div className="basis-full mb-1 text-sm text-ink-muted">{note}</div>}
      <div className="flex flex-wrap items-center gap-2">{start}</div>
      {/* ml-auto: ボタン列が折り返して単独行になっても右寄せのまま */}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}
