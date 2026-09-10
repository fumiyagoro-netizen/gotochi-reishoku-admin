import type { ReactNode } from "react";

const LABEL = "flex items-center gap-2 text-sm font-medium text-ink mb-1.5";

export type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  /** role=alert で読み上げさせる */
  error?: ReactNode;
  /** ラベル右の補助（settings 郵送先住所の「未設定」Badge 等） */
  labelAddon?: ReactNode;
  /** チェックボックス行: 入力を先頭に置き、ラベルを太字にしない */
  inline?: boolean;
  /** 指定時は <div> ＋ <label htmlFor>。既定は <label className="block"> で包んで暗黙関連付け */
  htmlFor?: string;
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

export function Field({ label, hint, error, labelAddon, inline, htmlFor, children }: FieldProps) {
  if (inline) {
    const row = (
      <label htmlFor={htmlFor} className="flex items-center gap-2 text-sm text-ink">
        {children}
        {label}
        {labelAddon}
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
      <div>
        <label htmlFor={htmlFor} className={LABEL}>
          {label}
          {labelAddon}
        </label>
        {children}
        <Notes hint={hint} error={error} />
      </div>
    );
  }

  return (
    <label className="block">
      <span className={LABEL}>
        {label}
        {labelAddon}
      </span>
      {children}
      <Notes hint={hint} error={error} />
    </label>
  );
}

/** フォーム内の小節見出し（form-builder の border-t 区切りに付ける） */
export function FieldsetTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-ink mb-3">{children}</h3>;
}
