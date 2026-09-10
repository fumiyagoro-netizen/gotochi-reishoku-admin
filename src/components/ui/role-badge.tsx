import { Badge, type BadgeSize } from "./badge";
import { ROLE_LABELS, type Role } from "@/lib/role-shared";

// 役割 → 完全クラス文字列。sidebar と users の両方がここを参照する
// （roleColors の二重定義と users 側の representative 欠落を解消）。
export const ROLE_BADGE_CLASS: Record<Role, string> = {
  admin: "bg-red-50 text-red-700 ring-red-600/20",
  representative: "bg-purple-50 text-purple-700 ring-purple-600/20",
  editor: "bg-blue-50 text-blue-700 ring-blue-600/20",
  viewer: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
  judge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

function isRole(value: string): value is Role {
  return Object.prototype.hasOwnProperty.call(ROLE_LABELS, value);
}

export type RoleBadgeProps = {
  /** users 一覧は API の文字列をそのまま渡すため string で受ける */
  role: string;
  size?: BadgeSize;
};

export function RoleBadge({ role, size }: RoleBadgeProps) {
  // 未知の値は viewer 色＋生文字列（users/page.tsx の `|| roleColors.viewer` と同じ約束）
  const known = isRole(role);
  return (
    <Badge
      tone="custom"
      size={size}
      className={known ? ROLE_BADGE_CLASS[role] : ROLE_BADGE_CLASS.viewer}
    >
      {known ? ROLE_LABELS[role] : role}
    </Badge>
  );
}
