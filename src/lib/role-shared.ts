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
  editor: "削除・受賞設定・見込み客・フォーム以外の操作が可能",
  viewer: "閲覧のみ（個人情報は非表示）",
  judge: "審査コメントの投稿のみ可能（その他は閲覧のみ・個人情報は非表示）",
};

// canManageContacts / canManageForms gate the "見込み客" (contacts) and
// "フォーム" (forms) features as a whole (list/detail pages, create, edit,
// delete, CSV/entry import, submission export, etc).
//
// These are intentionally separate from canSeePrivateInfo and canEdit rather
// than reusing them, because those two flags are shared with unrelated
// entry-side behavior:
//   - canSeePrivateInfo also controls whether an entry's applicant contact
//     info (name/email/phone) is masked — see src/lib/entry-privacy.ts and
//     src/app/entries/page.tsx / src/app/entries/[id]/page.tsx. editor must
//     keep canSeePrivateInfo=true so entry personal info stays visible, even
//     though editor must NOT see the separate contacts feature.
//   - canEdit also controls entry editing. editor must keep canEdit=true for
//     entries while losing the ability to edit forms.
// Endpoints/pages for contacts and forms should check canManageContacts /
// canManageForms first (feature access), then the existing operation-level
// flag (canEdit/canDelete/canUpload/canDownload/canSendEmail) same as before
// — this file's other flags are unchanged and still enforce the *kind* of
// operation once feature access is granted.
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
    canManageContacts: true,
    canManageForms: true,
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
    canManageContacts: true,
    canManageForms: true,
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
    // editor may not access the 見込み客 (contacts) or フォーム (forms)
    // features at all — see the comment above PERMISSIONS.
    canManageContacts: false,
    canManageForms: false,
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
    canManageContacts: false,
    canManageForms: false,
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
    canManageContacts: false,
    canManageForms: false,
  },
} as const;

export type Permissions = (typeof PERMISSIONS)[Role];

export function getPermissions(role: Role): Permissions {
  return PERMISSIONS[role];
}
