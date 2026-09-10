export type AvatarProps = {
  /** メール先頭 1 文字（大文字化は呼び出し側） */
  initial: string;
  /** 全文（メールアドレス）をツールチップで確認できるようにする */
  title?: string;
};

export function Avatar({ initial, title }: AvatarProps) {
  return (
    <span
      title={title}
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-caption font-medium text-ink-muted"
    >
      {initial}
    </span>
  );
}
