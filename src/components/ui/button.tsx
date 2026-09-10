import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";
import { Loader2 } from "./icons";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "dangerGhost"
  | "link"
  | "linkDanger";
export type ButtonSize = "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors select-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 " +
  "disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:size-4 [&_svg]:shrink-0";

// text-sm と text-caption を同じ要素に重ねない（CSS の出力順に依存させない）ため文字サイズは size 側に持つ
const SIZE: Record<ButtonSize, string> = {
  md: "h-9 px-3.5 text-sm",
  sm: "h-8 px-3 text-caption",
};

// link / linkDanger は表内の「編集」「配信を再開」「削除」等の文字リンク型。
// 高さ・余白を持たず行高 40px を崩さない。フォーカスリングの色は variant 側に持つ
const LINK_BASE =
  "inline-flex items-center gap-1 rounded-sm whitespace-nowrap transition-colors select-none " +
  "hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:size-4 [&_svg]:shrink-0";

const LINK_SIZE: Record<ButtonSize, string> = {
  md: "text-sm",
  sm: "text-caption",
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover",
  secondary: "bg-surface text-ink border border-line-strong shadow-xs hover:bg-surface-muted",
  ghost: "text-ink-muted hover:bg-surface-muted hover:text-ink",
  // 確認後の「削除する」「実行する」
  danger: "bg-danger text-white hover:bg-danger-ink",
  // 初期の「削除」「取り消す」など
  dangerGhost: "text-danger hover:bg-danger-soft",
  // 文字リンク型（LINK_BASE と組む）
  link: "text-accent focus-visible:ring-accent/40",
  linkDanger: "text-danger focus-visible:ring-danger/40",
};

function isLinkVariant(variant: ButtonVariant): boolean {
  return variant === "link" || variant === "linkDanger";
}

export function buttonClassName({
  variant = "secondary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  if (isLinkVariant(variant)) {
    return cn(LINK_BASE, LINK_SIZE[size], VARIANT[variant], className);
  }
  return cn(BASE, SIZE[size], VARIANT[variant], className);
}

type ButtonStyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 左側の lucide アイコン（16px に自動調整） */
  icon?: ReactNode;
  iconRight?: ReactNode;
};

function ButtonContent({
  icon,
  iconRight,
  loading,
  children,
}: {
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <>
      {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : icon}
      {children}
      {iconRight}
    </>
  );
}

export type ButtonProps = ButtonStyleProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    /** スピナーを先頭に出す。disabled は呼び出し側の式をそのまま渡す（勝手に disabled にしない） */
    loading?: boolean;
    ref?: Ref<HTMLButtonElement>;
  };

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  loading = false,
  type = "button",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      className={buttonClassName({ variant, size, className })}
      {...rest}
    >
      <ButtonContent icon={icon} iconRight={iconRight} loading={loading}>
        {children}
      </ButtonContent>
    </button>
  );
}

export type ButtonLinkProps = ButtonStyleProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "download" | "target"> & {
    href: string;
    /** 外部 URL・API 経由のファイル取得など next/link を通したくないとき */
    external?: boolean;
    download?: boolean | string;
    target?: string;
    ref?: Ref<HTMLAnchorElement>;
  };

/**
 * ボタンの見た目をしたリンク。external / download / target のいずれかを指定すると
 * <a> を出す（Excel・PDF の <a href> は要素種を変えない）。それ以外は next/link。
 */
export function ButtonLink({
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  href,
  external,
  download,
  target,
  rel,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  const cls = buttonClassName({ variant, size, className });
  const content = (
    <ButtonContent icon={icon} iconRight={iconRight}>
      {children}
    </ButtonContent>
  );

  if (external || download !== undefined || target) {
    return (
      <a
        href={href}
        target={target}
        download={download}
        rel={rel ?? (target === "_blank" ? "noopener noreferrer" : undefined)}
        className={cls}
        {...rest}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} rel={rel} className={cls} {...rest}>
      {content}
    </Link>
  );
}
