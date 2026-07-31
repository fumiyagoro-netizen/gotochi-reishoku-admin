/**
 * Server-only helpers for keeping applicant personal information (contact
 * name / email / phone / submitter IP) out of the browser for roles that
 * are not allowed to see it (i.e. `viewer` — `getPermissions(role)
 * .canSeePrivateInfo === false`).
 *
 * IMPORTANT: Next.js serializes every prop passed from a Server Component
 * into a "use client" component and ships it to the browser as-is, even if
 * the client component's TypeScript type only declares a subset of fields
 * and even if the UI never renders them. Hiding a column or masking a value
 * in JSX does NOT stop the underlying data from reaching the browser — the
 * raw value is still visible in the RSC payload / devtools. These helpers
 * must be applied to query results BEFORE they are passed as props to any
 * "use client" component (e.g. EntryTable, EntryDetail), for any request
 * where the current role's canSeePrivateInfo is false.
 *
 * Each function returns a brand new object (never mutates the input), so
 * there is no risk of the original plaintext value leaking through a
 * shared reference.
 */

const PRIVATE_TEXT_FIELDS = [
  "contactLastName",
  "contactFirstName",
  "email",
  "phone",
] as const;

const PRIVATE_META_FIELDS = ["ipAddress"] as const;

type EntryPrivateFields = Record<
  (typeof PRIVATE_TEXT_FIELDS)[number] | (typeof PRIVATE_META_FIELDS)[number],
  string
>;

function maskPrivateValue(value: string): string {
  if (!value) return "";
  if (value.includes("@")) {
    const [local, domain] = value.split("@");
    return local.slice(0, 2) + "***@" + domain;
  }
  if (/^[\d-]+$/.test(value)) {
    return value.slice(0, 3) + "****" + value.slice(-2);
  }
  return "***";
}

/**
 * Returns a new copy of `entry` with contact name / email / phone replaced
 * by a masked placeholder string (e.g. "ta***@example.com") and ipAddress
 * blanked. Use this where the UI still shows a "masked" row for viewers
 * (e.g. the entry detail page) — the client component must render the
 * value as-is and must NOT re-derive a mask from a plaintext value it
 * never received.
 */
export function maskEntryPrivateFields<T extends EntryPrivateFields>(entry: T): T {
  const masked: T = { ...entry };
  for (const field of PRIVATE_TEXT_FIELDS) {
    masked[field] = maskPrivateValue(entry[field]) as T[typeof field];
  }
  for (const field of PRIVATE_META_FIELDS) {
    masked[field] = "" as T[typeof field];
  }
  return masked;
}

/**
 * Returns a new copy of `entry` with contact name / email / phone /
 * ipAddress fully blanked (empty string). Use this where the UI hides the
 * field/column entirely for viewers (e.g. the entry list table's
 * "担当者" column).
 */
export function stripEntryPrivateFields<T extends EntryPrivateFields>(entry: T): T {
  const stripped: T = { ...entry };
  for (const field of [...PRIVATE_TEXT_FIELDS, ...PRIVATE_META_FIELDS]) {
    stripped[field] = "" as T[typeof field];
  }
  return stripped;
}
