/** Shared 審査状況 (review status) constants - safe for both client and server */

// Entry.reviewStatus はカンマ区切りのタグ文字列。配列順は review-status-selector.tsx
// のボタン順（選外 → 1次 → 2次）を正とする。reviews のタイルは別順（1次 → 2次 → 選外）
// なので、そちらはページ側で並べ替える。entry-table の一括用配列（rejected 無し）は
// 「一括で選外を付けない」仕様のため統合しない。
export const REVIEW_STATUSES = [
  { value: "rejected", label: "選外" },
  { value: "first_passed", label: "1次審査通過" },
  { value: "second_passed", label: "2次審査通過" },
] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number]["value"];

export const REVIEW_LABELS: Record<ReviewStatus, string> = {
  rejected: "選外",
  first_passed: "1次審査通過",
  second_passed: "2次審査通過",
};

// Badge tone="custom" に渡す完全クラス文字列。
// 到着系（sky / purple）と見分けるため red / emerald / indigo を使う。
export const REVIEW_BADGE_CLASS: Record<ReviewStatus, string> = {
  rejected: "bg-red-50 text-red-700 ring-red-600/20",
  first_passed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  second_passed: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
};

// TogglePill の pressed 時に渡す完全クラス文字列（枠線は border 配合）
export const REVIEW_PILL_CLASS: Record<ReviewStatus, string> = {
  rejected: "bg-red-50 text-red-700 border-red-300",
  first_passed: "bg-emerald-50 text-emerald-700 border-emerald-300",
  second_passed: "bg-indigo-50 text-indigo-700 border-indigo-300",
};

export function parseReviewStatuses(raw: string): string[] {
  if (!raw) return [];
  return raw.split(",").filter(Boolean);
}

export function isReviewStatus(value: unknown): value is ReviewStatus {
  return typeof value === "string" && value in REVIEW_LABELS;
}
