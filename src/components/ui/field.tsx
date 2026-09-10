import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const LABEL = "flex items-center gap-2 text-sm font-medium text-ink mb-1.5";
// ラベル横の薄字補足（「任意」「最大 5 件」等）。太字のラベルに混ざらないよう font-normal
const LABEL_HINT = "text-caption font-normal text-ink-subtle";

export type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  /** role=alert で読み上げさせる */
  error?: ReactNode;
  /** ラベル横の薄字補足。labelAddon の前に出る */
  labelHint?: ReactNode;
  /** ラベル右の補助（settings 郵送先住所の「未設定」Badge 等） */
  labelAddon?: ReactNode;
  /** チェックボックス行: 入力を先頭に置き、ラベルを太字にしない */
  inline?: boolean;
  /** 指定時は <div> ＋ <label htmlFor>。既定は <label className="block"> で包んで暗黙関連付け */
  htmlFor?: string;
  /** inline ではラベル行（cursor-pointer 用）、それ以外は外側要素に付く */
  className?: string;
  children: ReactNode;
};

function Notes({ hint, error }: Pick<FieldProps, "hint" | "error">) {
  return (
    <>
      {hint && <p className="mt-1.5 text-caption text-ink-subtle leading-5">{hint}</p>}
      {error && (
        <p className="mt-1.5 text-caption text-danger" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function LabelText({ label, labelHint, labelAddon }: Pick<FieldProps, "label" | "labelHint" | "labelAddon">) {
  return (
    <>
      {label}
      {labelHint && <span className={LABEL_HINT}>{labelHint}</span>}
      {labelAddon}
    </>
  );
}

export function Field({
  label,
  hint,
  error,
  labelHint,
  labelAddon,
  inline,
  htmlFor,
  className,
  children,
}: FieldProps) {
  if (inline) {
    const row = (
      <label htmlFor={htmlFor} className={cn("flex items-center gap-2 text-sm text-ink", className)}>
        {children}
        <LabelText label={label} labelHint={labelHint} labelAddon={labelAddon} />
      </label>
    );
    // 注記が無ければ余計な div を挟まない（横並びのチェック行で使えるように）
    if (!hint && !error) return row;
    return (
      <div>
        {row}
        <Notes hint={hint} error={error} />
      </div>
    );
  }

  if (htmlFor) {
    return (
      <div className={className}>
        <label htmlFor={htmlFor} className={LABEL}>
          <LabelText label={label} labelHint={labelHint} labelAddon={labelAddon} />
        </label>
        {children}
        <Notes hint={hint} error={error} />
      </div>
    );
  }

  return (
    <label className={cn("block", className)}>
      <span className={LABEL}>
        <LabelText label={label} labelHint={labelHint} labelAddon={labelAddon} />
      </span>
      {children}
      <Notes hint={hint} error={error} />
    </label>
  );
}

export type FieldLabelProps = {
  /** 群を aria-labelledby で結びつけるときの id */
  id?: string;
  /** ラベル横の薄字補足（Field の labelHint と同じ見た目） */
  hint?: ReactNode;
  /** ラベル右の補助（Field の labelAddon と同じ位置） */
  addon?: ReactNode;
  className?: string;
  children: ReactNode;
};

/**
 * label 要素を使わない見出しだけの部品。CheckPill 群・FileInput のように子が自前の <label> を
 * 持つ場合に、Field で二重の label を作らないために使う。見た目は Field のラベルと同じ。
 */
export function FieldLabel({ id, hint, addon, className, children }: FieldLabelProps) {
  return (
    <div id={id} className={cn(LABEL, className)}>
      {children}
      {hint && <span className={LABEL_HINT}>{hint}</span>}
      {addon}
    </div>
  );
}

/** フォーム内の小節見出し（form-builder の border-t 区切りに付ける） */
export function FieldsetTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-ink mb-3">{children}</h3>;
}
