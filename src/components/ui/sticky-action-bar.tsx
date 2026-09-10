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
 * 長いフォームの保存・キャンセル行。PageContainer の px-8 を -mx-8 / px-8 で打ち消して全幅にする。
 * entry-detail では #entry-detail の外に置き、html2canvas の撮影範囲に入れない。
 */
export function StickyActionBar({ start, children, error }: StickyActionBarProps) {
  return (
    <div className="sticky bottom-0 z-10 -mx-8 mt-6 border-t border-line bg-surface/95 backdrop-blur px-8 py-3">
      {error && <div className="mb-3">{error}</div>}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">{start}</div>
        <div className="flex items-center gap-2">{children}</div>
      </div>
    </div>
  );
}
