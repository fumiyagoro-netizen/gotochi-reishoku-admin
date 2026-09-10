import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ExternalLink, EyeOff } from "./icons";

/** ラベル幅 9rem で「営業許可証（エントリー商品）」が2行に収まる */
export function KeyValueList({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-3">{children}</dl>;
}

export type KeyValueProps = {
  label: ReactNode;
  children?: ReactNode;
  /** サーバーでマスク済みの値をそのまま表示する（クライアントで再計算しない） */
  masked?: boolean;
  /** mailto: や外部 URL。値をリンクにする */
  link?: string;
  /** 編集中。children に Input size="sm" を入れる */
  editing?: boolean;
};

export function KeyValue({ label, children, masked, link, editing }: KeyValueProps) {
  const isMasked = masked && !editing;
  const isMailto = link?.startsWith("mailto:");

  let value: ReactNode = children;
  if (!editing && isMasked) {
    value = (
      <>
        <EyeOff className="size-3 inline mr-1" aria-hidden="true" />
        {children}
      </>
    );
  } else if (!editing && link) {
    value = (
      <a
        href={link}
        // メールは同じタブで、外部 URL は別タブで開く（既存の mailto / target=_blank の使い分け）
        target={isMailto ? undefined : "_blank"}
        rel={isMailto ? undefined : "noopener noreferrer"}
        className="rounded-sm text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {children}
        <ExternalLink className="size-3 inline ml-1" aria-hidden="true" />
      </a>
    );
  }

  return (
    <>
      <dt className="text-caption text-ink-subtle pt-1 leading-5">{label}</dt>
      <dd
        className={cn(
          "text-sm min-w-0 break-words",
          isMasked ? "text-ink-faint italic" : "text-ink",
        )}
      >
        {value}
      </dd>
    </>
  );
}
