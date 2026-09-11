/** Shared 受賞 (prize) constants - safe for both client and server */

// 表示順（ダッシュボードの内訳・受賞一覧のタイル・一括設定の並び）
export const PRIZE_LEVELS = ["最高金賞", "金賞", "銀賞", "銅賞"] as const;

export type PrizeLevel = (typeof PRIZE_LEVELS)[number];

export function isPrizeLevel(value: unknown): value is PrizeLevel {
  return typeof value === "string" && (PRIZE_LEVELS as readonly string[]).includes(value);
}

// Badge tone="custom" に渡す完全クラス文字列（bg / text / ring の配合1本）。
// 銀賞は画面ごとに違っていた値を zinc に統一。
export const PRIZE_BADGE_CLASS: Record<PrizeLevel, string> = {
  最高金賞: "bg-amber-50 text-amber-800 ring-amber-600/25",
  金賞: "bg-yellow-50 text-yellow-800 ring-yellow-600/25",
  銀賞: "bg-zinc-100 text-zinc-700 ring-zinc-500/25",
  銅賞: "bg-orange-50 text-orange-800 ring-orange-600/25",
};

// ProgressBar の塗り。銀賞はトラック(bg-surface-muted)に沈まない zinc-400
export const PRIZE_BAR_CLASS: Record<PrizeLevel, string> = {
  最高金賞: "bg-amber-400",
  金賞: "bg-yellow-400",
  銀賞: "bg-zinc-400",
  銅賞: "bg-orange-400",
};

// FilterTile / BulkActionBar の小さな点
export const PRIZE_DOT_CLASS: Record<PrizeLevel, string> = {
  最高金賞: "bg-amber-400",
  金賞: "bg-yellow-400",
  銀賞: "bg-zinc-400",
  銅賞: "bg-orange-400",
};

// グランプリ（称号）。段階（prizeLevel）ではなく EntryTitle.name で持つ（prisma/schema.prisma の EntryTitle）。
// 最高金賞の中から1年度に1品。付け外しは src/app/api/entries/[id]/grand-prix
export const GRAND_PRIX_TITLE = "グランプリ";
export const GRAND_PRIX_PRIZE_LEVEL: PrizeLevel = "最高金賞";

// Badge tone="custom" 用。最高金賞（amber-50）より一段濃い金で、並べても区別できるようにする
export const GRAND_PRIX_BADGE_CLASS = "bg-amber-400 text-amber-950 ring-amber-600/40";
// TogglePill toneClassName（押した状態）用
export const GRAND_PRIX_PILL_CLASS = "border-amber-500 bg-amber-100 text-amber-900";
