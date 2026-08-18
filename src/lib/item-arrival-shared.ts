/** Shared 商品到着 (item arrival) constants - safe for both client and server */

// Entry.itemArrivalStatus is a comma-separated tag string, same storage
// shape as reviewStatus (see review-status-selector.tsx), but a completely
// separate column/permission (canSetItemArrival in src/lib/role-shared.ts) —
// it records whether the physical review sample arrived at the office, not
// a judging outcome, so editor may toggle it even though editor cannot
// touch reviewStatus. Centralized here (unlike REVIEW_STATUSES, which is
// duplicated per-file) because the spec for this feature calls for one
// shared source used from both client components and server routes.
export const ITEM_ARRIVAL_STATUSES = [
  { value: "second_arrived", label: "2次審査商品到着", icon: "📦" },
  { value: "final_arrived", label: "最終審査商品到着", icon: "📦" },
] as const;

export type ItemArrivalStatus = (typeof ITEM_ARRIVAL_STATUSES)[number]["value"];

export const ITEM_ARRIVAL_LABELS: Record<ItemArrivalStatus, string> = {
  second_arrived: "2次審査商品到着",
  final_arrived: "最終審査商品到着",
};

// Deliberately a different color family from REVIEW_COLORS (green/indigo/
// red in review-status-selector.tsx) so the two label families never look
// alike at a glance — item arrival uses sky/purple instead.
export const ITEM_ARRIVAL_COLORS: Record<
  ItemArrivalStatus,
  { bg: string; text: string; border: string }
> = {
  second_arrived: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-300" },
  final_arrived: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-300" },
};

export function parseItemArrivalStatuses(raw: string): string[] {
  if (!raw) return [];
  return raw.split(",").filter(Boolean);
}

export function isItemArrivalStatus(value: unknown): value is ItemArrivalStatus {
  return typeof value === "string" && value in ITEM_ARRIVAL_LABELS;
}
