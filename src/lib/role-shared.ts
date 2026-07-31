/** Shared role types and constants - safe for both client and server */

export type Role = "admin" | "editor" | "viewer" | "representative" | "judge";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "管理者",
  representative: "代表者",
  editor: "編集者",
  viewer: "閲覧者",
  judge: "審査員",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "すべての操作が可能",
  representative: "設定・ユーザー管理・操作ログ・エントリー削除・年度管理を除く操作が可能",
  editor: "削除・受賞設定以外の操作が可能",
  viewer: "閲覧のみ（個人情報は非表示）",
  judge: "審査コメントの投稿のみ可能（その他は閲覧のみ・個人情報は非表示）",
};

export const PERMISSIONS = {
  admin: {
    canDelete: true,
    canSetPrize: true,
    canEdit: true,
    canUpload: true,
    canDownload: true,
    canSeePrivateInfo: true,
    // Mass email (marketing-style) sending is restricted to admins only.
    // Fixed-template transactional mail (entry confirmation, admin
    // notifications, review-pass notices) is NOT gated by this flag.
    canSendEmail: true,
    // Posting an entry's review comment (src/app/api/entries/[id]/comments).
    // Comment *deletion* is a separate rule (own comment, or admin for any
    // comment) handled directly in that API route — this flag only gates
    // who may create one.
    canReviewComment: true,
  },
  // Sits between admin and editor: same as admin except cannot delete entries.
  // Settings/user-management/audit-log/award-management access is NOT
  // controlled by these flags — those stay hardcoded to admin-only (see
  // src/app/settings, src/app/users, src/app/logs, src/app/award-settings
  // and their API routes).
  representative: {
    canDelete: false,
    canSetPrize: true,
    canEdit: true,
    canUpload: true,
    canDownload: true,
    canSeePrivateInfo: true,
    canSendEmail: true,
    canReviewComment: true,
  },
  editor: {
    canDelete: false,
    canSetPrize: false,
    canEdit: true,
    canUpload: true,
    canDownload: true,
    canSeePrivateInfo: true,
    canSendEmail: false,
    canReviewComment: false,
  },
  viewer: {
    canDelete: false,
    canSetPrize: false,
    canEdit: false,
    canUpload: false,
    canDownload: false,
    canSeePrivateInfo: false,
    canSendEmail: false,
    canReviewComment: false,
  },
  // Same as viewer in every respect (read-only, no private info) except it
  // may post entry review comments. Introduced so outside judges can leave
  // comments without gaining any of viewer's other-than-read-only access.
  judge: {
    canDelete: false,
    canSetPrize: false,
    canEdit: false,
    canUpload: false,
    canDownload: false,
    canSeePrivateInfo: false,
    canSendEmail: false,
    canReviewComment: true,
  },
} as const;

export type Permissions = (typeof PERMISSIONS)[Role];

export function getPermissions(role: Role): Permissions {
  return PERMISSIONS[role];
}
