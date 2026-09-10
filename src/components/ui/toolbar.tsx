import type { ComponentProps, ReactNode } from "react";
import { Badge } from "./badge";
import { Input } from "./field-controls";
import { Search } from "./icons";

export type ToolbarProps = {
  children: ReactNode;
  /** 絞り込みが効いているか。ページ側の (q || category) 等をそのまま渡す */
  applied?: boolean;
  /** 既存の「クリア」Link/button を ghost にして渡す。applied のときだけ出る */
  clear?: ReactNode;
};

/**
 * 検索行。form 要素（method GET / onSubmit / hidden year / name）は各ページのものを children に置く。
 * 同じ行に並ぶ部品は全部 h-9 に揃える。
 */
export function Toolbar({ children, applied, clear }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {children}
      {applied && (
        <>
          <Badge tone="info" dot>
            絞り込み中
          </Badge>
          {clear}
        </>
      )}
    </div>
  );
}

export type SearchInputProps = Omit<ComponentProps<typeof Input>, "leadingIcon"> & {
  /** 絞り込み中は黒枠（Input の data-active）にする */
  active?: boolean;
};

export function SearchInput({ active, ...rest }: SearchInputProps) {
  return (
    // Input は w-full なので幅はラッパーで決める（w-full と w-72 を同じ要素に重ねない）
    <div className="w-72 min-w-[220px]">
      <Input leadingIcon={<Search />} data-active={active ? "true" : undefined} {...rest} />
    </div>
  );
}
