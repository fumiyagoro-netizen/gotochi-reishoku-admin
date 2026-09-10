"use client";

// FileInput が選択中ファイル名を state で持つため、このファイルだけ "use client"。
// Input / Select / Textarea / Checkbox / Radio に hooks は無く、
// サーバーページ（GET 検索フォーム等）からも name / defaultValue で使える。

import {
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";
import { ChevronDown, Upload } from "./icons";

export type ControlSize = "md" | "sm";

// 入力欄共通の枠。入力欄だけは focus:（focus-visible ではなく）で反応させる。
// data-[active=true] は Toolbar の絞り込み中に黒枠にするためのフック。
const FRAME =
  "block w-full rounded-md border border-line-strong bg-surface text-ink shadow-xs placeholder:text-ink-faint transition-colors " +
  "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 " +
  "disabled:bg-surface-muted disabled:text-ink-subtle disabled:shadow-none disabled:cursor-not-allowed " +
  "read-only:bg-surface-muted data-[active=true]:border-ink";

const SIZE: Record<ControlSize, string> = {
  md: "h-9 text-sm",
  sm: "h-8 text-caption",
};
const PAD_LEFT: Record<ControlSize, string> = { md: "pl-3", sm: "pl-2.5" };
const PAD_RIGHT: Record<ControlSize, string> = { md: "pr-3", sm: "pr-2.5" };

const INVALID = "border-danger focus:border-danger focus:ring-danger/20";
const ALIGN_RIGHT = "text-right tabular-nums";

// leadingIcon（Search 等）の置き場。入力側は pl-9 で逃がす
const LEADING =
  "pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 text-ink-subtle [&_svg]:size-4 [&_svg]:shrink-0";

type ControlExtras = {
  size?: ControlSize;
  /** true で border-danger ＋ aria-invalid */
  invalid?: boolean;
  align?: "left" | "right";
  leadingIcon?: ReactNode;
};

/* ---------------------------------------------------------------- Input */

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> &
  ControlExtras & {
    /** React 19: ref は通常 prop（composer の insertTag・invoice-form の Enter 検索が使う） */
    ref?: Ref<HTMLInputElement>;
  };

export function Input({
  size = "md",
  invalid,
  align = "left",
  leadingIcon,
  className,
  ...rest
}: InputProps) {
  const input = (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        FRAME,
        SIZE[size],
        leadingIcon ? "pl-9" : PAD_LEFT[size],
        PAD_RIGHT[size],
        invalid && INVALID,
        align === "right" && ALIGN_RIGHT,
        className,
      )}
      {...rest}
    />
  );
  if (!leadingIcon) return input;
  return (
    <div className="relative">
      <span className={LEADING}>{leadingIcon}</span>
      {input}
    </div>
  );
}

/* --------------------------------------------------------------- Select */

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> &
  ControlExtras & {
    ref?: Ref<HTMLSelectElement>;
  };

export function Select({
  size = "md",
  invalid,
  align = "left",
  leadingIcon,
  className,
  children,
  ...rest
}: SelectProps) {
  return (
    <div className="relative">
      {leadingIcon && <span className={LEADING}>{leadingIcon}</span>}
      <select
        aria-invalid={invalid || undefined}
        className={cn(
          FRAME,
          SIZE[size],
          "appearance-none pr-9",
          leadingIcon ? "pl-9" : PAD_LEFT[size],
          invalid && INVALID,
          align === "right" && ALIGN_RIGHT,
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-ink-subtle"
        aria-hidden="true"
      />
    </div>
  );
}

/* ------------------------------------------------------------- Textarea */

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
};

// mono は用意しない（メール本文の font-mono を解除する方針）
export function Textarea({ invalid, className, ...rest }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        FRAME,
        "min-h-[5.5rem] px-3 py-2 text-sm leading-6",
        invalid && INVALID,
        className,
      )}
      {...rest}
    />
  );
}

/* ------------------------------------------------------ Checkbox / Radio */

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  ref?: Ref<HTMLInputElement>;
};

const CHECK_BASE =
  "size-4 border-line-strong accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

/** aria-label 推奨（全選択・行選択のように可視ラベルが無い場合） */
export function Checkbox({ className, ...rest }: CheckboxProps) {
  return <input type="checkbox" className={cn(CHECK_BASE, "rounded-sm", className)} {...rest} />;
}

export function Radio({ className, ...rest }: CheckboxProps) {
  return <input type="radio" className={cn(CHECK_BASE, "rounded-full", className)} {...rest} />;
}

/* ------------------------------------------------------------ FileInput */

export type FileInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & {
  /** 未選択時に右側へ出す補足（例: 「.csv」） */
  hint?: string;
  ref?: Ref<HTMLInputElement>;
};

export function FileInput({ hint, onChange, ...rest }: FileInputProps) {
  // sr-only にした native input の代わりに、選択中ファイル名をここで見せる
  const [fileName, setFileName] = useState<string | null>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    setFileName(
      files && files.length > 0 ? Array.from(files).map((f) => f.name).join("、") : null,
    );
    onChange?.(e);
  }

  return (
    <label
      className={
        "flex items-center gap-3 rounded-md border border-dashed border-line-strong bg-surface-muted/60 px-4 py-3 " +
        "cursor-pointer hover:border-ink focus-within:ring-2 focus-within:ring-accent/40"
      }
    >
      <Upload className="size-4 text-ink-subtle" aria-hidden="true" />
      <span className="text-sm text-ink">ファイルを選択</span>
      <span
        className="ml-auto min-w-0 text-caption text-ink-subtle truncate"
        title={fileName ?? undefined}
      >
        {fileName ?? hint}
      </span>
      <input type="file" className="sr-only" onChange={handleChange} {...rest} />
    </label>
  );
}
