/** Shared role types and constants - safe for both client and server */

export type Role = "admin" | "editor" | "viewer";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "管理者",
  editor: "編集者",
  viewer: "閲覧者",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "すべての操作が可能",
  editor: "削除・受賞設定以外の操作が可能",
  viewer: "閲覧のみ（個人情報は非表示）",
};

export const PERMISSIONS = {
  admin: {
    canDelete: true,
    canSetPrize: true,
    canEdit: true,
    canUpload: true,
    canDownload: true,
    canSeePrivateInfo: true,
  },
  editor: {
    canDelete: false,
    canSetPrize: false,
    canEdit: true,
    canUpload: true,
    canDownload: true,
    canSeePrivateInfo: true,
  },
  viewer: {
    canDelete: false,
    canSetPrize: false,
    canEdit: false,
    canUpload: false,
    canDownload: false,
    canSeePrivateInfo: false,
  },
} as const;

export type Permissions = (typeof PERMISSIONS)[Role];

export function getPermissions(role: Role): Permissions {
  return PERMISSIONS[role];
}
