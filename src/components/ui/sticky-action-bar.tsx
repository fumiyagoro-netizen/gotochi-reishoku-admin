import type { ReactNode } from "react";

export type StickyActionBarProps = {
  /** 左: 削除 dangerGhost / InlineConfirm */
  start?: ReactNode;
  /** 右: secondary → primary の順 */
  children: ReactNode;
  /** バー直上に出すエラー Alert。最上部と同じ state を渡して二重描画する */
  error?: ReactNode;
};

/**
 * 長いフォームの保存・キャンセル行。PageContainer の左右余白（px-4 / md:px-8）を同じ量の負マージンで打ち消して全幅にする。
 * entry-detail では #entry-detail の外に置く（保存バーは紙面の一部ではないため）。
 */
export function StickyActionBar({ start, children, error }: StickyActionBarProps) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-line bg-surface/95 backdrop-blur px-4 py-3 md:-mx-8 md:px-8">
      {error && <div className="mb-3">{error}</div>}
      {/* 幅が足りないとき（スマホ）はボタンを折り返す。右側のボタン列は折り返しても右寄せのまま */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">{start}</div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{children}</div>
      </div>
    </div>
  );
}
