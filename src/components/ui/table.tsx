import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Card } from "./card";
import { ImageOff } from "./icons";

export type TableDensity = "default" | "compact";

export type TableProps = {
  /** table-fixed。colgroup は children で渡す（prospects） */
  fixed?: boolean;
  /** compact は行の上下余白を詰める（invoice-form 明細・logs・email-logs 明細） */
  density?: TableDensity;
  children: ReactNode;
};

export function Table({ fixed, density = "default", children }: TableProps) {
  return (
    <Card padding="none" clip>
      <div className="overflow-x-auto">
        {/* density は context を使わず table 側から td を指定する（hooks なしでサーバーから使うため） */}
        <table
          className={cn(
            "w-full text-sm",
            fixed && "table-fixed",
            density === "compact" && "[&_td]:py-1.5",
          )}
        >
          {children}
        </table>
      </div>
    </Card>
  );
}

type Align = "left" | "center" | "right";

const ALIGN: Record<Align, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export type ThProps = Omit<ThHTMLAttributes<HTMLTableCellElement>, "align"> & {
  align?: Align;
  /** 列幅のクラス文字列（w-10 / w-24 等） */
  width?: string;
  /** 見出し文字を出さない列（チェック列・削除列）の sr-only 見出し */
  srLabel?: string;
};

export function Th({ align = "left", width, srLabel, className, children, ...rest }: ThProps) {
  return (
    <th
      scope="col"
      className={cn(
        "h-9 px-3 text-caption font-medium text-ink-subtle bg-surface-muted/60 border-b border-line whitespace-nowrap align-middle first:pl-4 last:pr-4",
        ALIGN[align],
        width,
        className,
      )}
      {...rest}
    >
      {srLabel && <span className="sr-only">{srLabel}</span>}
      {children}
    </th>
  );
}

export type TdProps = Omit<TdHTMLAttributes<HTMLTableCellElement>, "align"> & {
  /** 主キー列（商品名など） */
  primary?: boolean;
  muted?: boolean;
  subtle?: boolean;
  /** 数値列: 右寄せ・等幅数字・折り返さない */
  numeric?: boolean;
  nowrap?: boolean;
  /** 長文を1行に切り詰める。切れた全文を title で読めるよう同じ文字列を渡す */
  truncate?: string;
  /** 複数行セルを上揃えにする */
  top?: boolean;
};

export function Td({
  primary,
  muted,
  subtle,
  numeric,
  nowrap,
  truncate,
  top,
  className,
  title,
  children,
  ...rest
}: TdProps) {
  return (
    <td
      title={truncate ?? title}
      className={cn(
        "px-3 py-2.5 first:pl-4 last:pr-4",
        top ? "align-top" : "align-middle",
        primary ? "font-medium text-ink" : subtle ? "text-ink-subtle" : "text-ink-muted",
        muted && !primary && !subtle && "text-ink-muted",
        numeric && "text-right tabular-nums whitespace-nowrap",
        nowrap && "whitespace-nowrap",
        truncate !== undefined && "max-w-0 truncate",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}

export type TrProps = HTMLAttributes<HTMLTableRowElement> & {
  /** 選択行。hover で選択色が消えないようにする */
  selected?: boolean;
  /** 「追客しない」・無効行。opacity ではなく文字色を落としてバッジは読めるままにする */
  muted?: boolean;
  tone?: "danger" | "purple";
  /** onClick を渡す行だけ true にする（押せない行に指カーソルを出さない） */
  clickable?: boolean;
};

export function Tr({ selected, muted, tone, clickable, className, children, ...rest }: TrProps) {
  return (
    <tr
      className={cn(
        "border-b border-line last:border-0 transition-colors",
        selected
          ? "bg-accent-soft hover:bg-accent-soft"
          : tone === "danger"
            ? "bg-danger-soft/60 hover:bg-danger-soft"
            : tone === "purple"
              ? "bg-purple-50/60 hover:bg-purple-50"
              : "hover:bg-surface-muted/50",
        muted && "bg-surface-muted/50 [&_td]:text-ink-subtle",
        clickable && "cursor-pointer",
        className,
      )}
      {...rest}
    >
      {children}
    </tr>
  );
}

/** 一覧のサムネイル（40px 固定）。画像が無いときは ImageOff のプレースホルダ */
export function Thumb({ src, alt }: { src?: string; alt: string }) {
  if (!src) {
    return (
      <div
        className="size-10 rounded-md bg-surface-muted flex items-center justify-center"
        title="画像なし"
      >
        <ImageOff className="size-4 text-ink-faint" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="size-10 rounded-md border border-line object-cover bg-surface-muted"
    />
  );
}
