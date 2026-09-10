import { cn } from "@/lib/cn";
import { Button } from "./button";

export type InlineConfirmTone = "danger" | "warning";

const TONE: Record<InlineConfirmTone, string> = {
  danger: "border-danger-line bg-danger-soft text-danger-ink",
  warning: "border-warning-line bg-warning-soft text-warning-ink",
};

export type InlineConfirmProps = {
  /** 既存文言をそのまま（「本当に削除しますか？」等） */
  message: string;
  /** 「削除する」「実行する」 */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** 既存の deleting / submitting */
  loading?: boolean;
  tone?: InlineConfirmTone;
};

/**
 * 「削除」→ 確認 → 実行 の確認段階だけを描く。confirming の分岐は呼び出し側に残す。
 * native confirm() を使っている箇所は置換しない。
 */
export function InlineConfirm({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  loading = false,
  tone = "danger",
}: InlineConfirmProps) {
  return (
    <div
      role="group"
      className={cn(
        "inline-flex flex-wrap items-center gap-2 rounded-md border px-3 py-1.5 text-caption",
        TONE[tone],
      )}
    >
      <span>{message}</span>
      <Button
        // warning（ResubscribeModal の再開確認）は危険色ではなく primary
        variant={tone === "danger" ? "danger" : "primary"}
        size="sm"
        loading={loading}
        // 既存の「削除中...」「実行中...」は disabled だったので、その期間だけ押せなくする
        disabled={loading}
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        キャンセル
      </Button>
    </div>
  );
}
