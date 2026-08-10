/** Shared 追客リスト (prospects) constants - safe for both client and server */

// Fixed choice list for Prospect.contactStatus. New rows default to the
// first value ("未着手") per the Prisma schema default. Keep this in sync
// with the schema comment on Prospect.contactStatus.
export const PROSPECT_CONTACT_STATUSES = [
  "未着手",
  "連絡済",
  "資料送付済",
  "エントリー意向",
  // Closed out rather than in progress: the list dims these rows so the
  // remaining prospects stand out. Kept last so the choices read in
  // roughly the order a prospect moves through them.
  "追客しない",
] as const;

/** Prospects marked this way are dimmed in the list — they need no follow-up. */
export const PROSPECT_STATUS_DROPPED = "追客しない";

export type ProspectContactStatus = (typeof PROSPECT_CONTACT_STATUSES)[number];

export function isProspectContactStatus(value: unknown): value is ProspectContactStatus {
  return (
    typeof value === "string" &&
    (PROSPECT_CONTACT_STATUSES as readonly string[]).includes(value)
  );
}

// Fixed choice list for Prospect.confidence. Unlike contactStatus this may
// also be "" (unset) — the source Excel always has one of these three, but a
// manually-added prospect can be left unrated.
export const PROSPECT_CONFIDENCE_LEVELS = ["高", "中", "低"] as const;

export type ProspectConfidenceLevel = (typeof PROSPECT_CONFIDENCE_LEVELS)[number];

export function isProspectConfidenceLevel(value: unknown): value is ProspectConfidenceLevel {
  return (
    typeof value === "string" &&
    (PROSPECT_CONFIDENCE_LEVELS as readonly string[]).includes(value)
  );
}
