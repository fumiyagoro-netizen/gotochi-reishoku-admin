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
  representative:
    "メール配信・フォーム・請求書・追客リストを担当。エントリーの編集／受賞・審査状況の設定／エントリーCSVの取り込みと、設定・ユーザー管理・操作ログ・年度管理・サイト管理は不可",
  editor: "追客リストと商品到着の記録を担当。エントリーの編集・受賞設定・メール配信・フォーム・請求書は不可",
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
//
// canManageProspects gates the "追客リスト" (prospects) feature as a whole
// (list page, create, edit, Excel import). Unlike canManageContacts /
// canManageForms it is NOT paired with canEdit/canSeePrivateInfo for
// read/write access — Prospect has no personal-data-masking concern (it's
// prospective business contacts, not applicant PII) and every role that can
// reach the feature at all (admin/representative/editor) may edit every
// field, so a single flag covers both "can see the page" and "can edit".
// DELETE is the one exception: it additionally requires canDelete, same as
// contacts/forms deletion — which in practice keeps prospect deletion
// admin-only, since representative/editor both have canDelete=false today.
//
// canSetItemArrival gates toggling Entry.itemArrivalStatus (審査用商品が
// 事務局に届いたかの記録 — see src/lib/item-arrival-shared.ts). It is
// deliberately its own flag rather than reuse of canSetPrize: canSetPrize
// also guards Entry.reviewStatus (the judging outcome), and editor must
// NOT be able to change reviewStatus. Item arrival is an unrelated
// logistics fact (did the sample physically arrive) that editor legitimately
// needs to record day-to-day, so editor gets canSetItemArrival: true while
// keeping canSetPrize: false — the two flags must never be merged into one
// check in the API routes, or editor would gain reviewStatus/prizeLevel
// access as a side effect.
//
// canManageInvoices gates the "請求書" (invoices) feature as a whole
// (invoice list/create/edit, the 請求項目マスタ, and PDF generation — see
// src/lib/invoice.ts). Unlike canManageProspects it is NOT given to editor:
// invoices are a real money document sent to entrant companies, and unlike
// item-arrival logistics there's no day-to-day operational need for editor
// to touch them, so this stays conservative (admin/representative only)
// rather than defaulting to open the way canManageProspects did. There is
// no explicit user instruction either way for editor here — this is a
// deliberate conservative default that should be revisited if editor turns
// out to need it.
// canEditEntry / canUploadEntryCsv はエントリー本体への書き込みを管理者だけに
// 絞るためのフラグ（2026年10月に事務局の指示で分離）。canEdit / canUpload を
// そのまま admin 限定にしなかったのは、あの2つがエントリー以外の機能と共有
// されているため:
//   - canEdit は canManageForms / canManageContacts と組で、フォームと
//     メール配信リストの編集も通している。admin 限定にすると代表者が
//     それらを編集できなくなる（指示に含まれていない巻き添え）。
//   - canUpload は canManageProspects / canManageContacts と組で、追客リストの
//     Excel 取り込みとメール配信リストの CSV 取り込みも通している。
// そこでエントリー側だけを新しい2つのフラグに移し、canEdit / canUpload の値は
// 変えていない。結果として editor の canEdit は「到達できる画面が無い」ため
// 現在は効き目が無いが、値を触ると他機能の判定まで動くので据え置いている。
//
// canEditEntry は /api/entries/[id] の PATCH 全体の入口。ただし商品到着だけの
// 更新（itemArrivalStatus 1項目のみ）はこの入口を通さず canSetItemArrival で
// 判定する — 商品到着は編集者が日々記録する運用で、エントリー本文の編集権限とは
// 別物だから（canSetPrize と canSetItemArrival を分けてあるのと同じ理由）。
//
// canUploadEntryCsv は /upload 画面と /api/upload・/api/upload/update。
// 一括更新の CSV には「受賞」「審査状況」の列があり、ルート側は canSetPrize を
// 見ていない（列ごとの権限判定をしていない）ため、canUpload のままだと編集者が
// CSV 経由で受賞を書き換えられてしまう。管理者限定にすることでこの抜け道も塞がる。
//
// canManageSite gates the "サイト管理" area as a whole (/site pages and the
// /api/site/* routes: 受賞商品の公開, お知らせ, 審査員, 開催概要 etc. — the public
// website's content, see docs/site-migration/README.md §4). Admin-only for
// now; widen it here (not in the pages) if 代表者 should edit site content.
// src/app/site/layout.tsx gates every /site page with it; each /api/site/*
// route must check it again because layouts don't run for API routes.
export const PERMISSIONS = {
  admin: {
    canDelete: true,
    canSetPrize: true,
    canEdit: true,
    canEditEntry: true,
    canUploadEntryCsv: true,
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
    canManageProspects: true,
    canSetItemArrival: true,
    canManageInvoices: true,
    canManageSite: true,
  },
  // Sits between admin and editor: same as admin except cannot delete entries.
  // Settings/user-management/audit-log/award-management access is NOT
  // controlled by these flags — those stay hardcoded to admin-only (see
  // src/app/settings, src/app/users, src/app/logs, src/app/award-settings
  // and their API routes).
  representative: {
    canDelete: false,
    canSetPrize: false,
    canEdit: true,
    canEditEntry: false,
    canUploadEntryCsv: false,
    canUpload: true,
    canDownload: true,
    canSeePrivateInfo: true,
    canSendEmail: true,
    canReviewComment: true,
    canManageContacts: true,
    canManageForms: true,
    canManageProspects: true,
    canSetItemArrival: true,
    canManageInvoices: true,
    canManageSite: false,
  },
  editor: {
    canDelete: false,
    canSetPrize: false,
    canEdit: true,
    canEditEntry: false,
    canUploadEntryCsv: false,
    canUpload: true,
    canDownload: true,
    canSeePrivateInfo: true,
    canSendEmail: false,
    canReviewComment: false,
    // editor may not access the 見込み客 (contacts) or フォーム (forms)
    // features at all — see the comment above PERMISSIONS. It DOES get
    // canManageProspects: true — 追客リスト is a separate feature editor is
    // meant to use day-to-day (unlike contacts/forms).
    canManageContacts: false,
    canManageForms: false,
    // editor keeps canSetItemArrival: true even though canSetPrize/
    // canReviewComment are false above — see the comment above PERMISSIONS.
    canManageProspects: true,
    canSetItemArrival: true,
    // Unlike canManageProspects, editor does NOT get canManageInvoices —
    // see the comment above PERMISSIONS.
    canManageInvoices: false,
    canManageSite: false,
  },
  viewer: {
    canDelete: false,
    canSetPrize: false,
    canEdit: false,
    canEditEntry: false,
    canUploadEntryCsv: false,
    canUpload: false,
    canDownload: false,
    canSeePrivateInfo: false,
    canSendEmail: false,
    canReviewComment: false,
    canManageContacts: false,
    canManageForms: false,
    canManageProspects: false,
    canSetItemArrival: false,
    canManageInvoices: false,
    canManageSite: false,
  },
  // Same as viewer in every respect (read-only, no private info) except it
  // may post entry review comments. Introduced so outside judges can leave
  // comments without gaining any of viewer's other-than-read-only access.
  judge: {
    canDelete: false,
    canSetPrize: false,
    canEdit: false,
    canEditEntry: false,
    canUploadEntryCsv: false,
    canUpload: false,
    canDownload: false,
    canSeePrivateInfo: false,
    canSendEmail: false,
    canReviewComment: true,
    canManageContacts: false,
    canManageForms: false,
    canManageProspects: false,
    canSetItemArrival: false,
    canManageInvoices: false,
    canManageSite: false,
  },
} as const;

export type Permissions = (typeof PERMISSIONS)[Role];

export function getPermissions(role: Role): Permissions {
  return PERMISSIONS[role];
}
