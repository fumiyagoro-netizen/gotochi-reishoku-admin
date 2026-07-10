import { prisma } from "./prisma";

/**
 * Applicant (Entry) email segment resolver.
 *
 * Deliberately independent from Contact/ContactList (see src/lib/contact.ts) —
 * this is a separate delivery flow that targets award applicants directly by
 * Award x reviewStatus x prizeLevel, not the marketing contact list.
 *
 * Suppression / Contact.subscribed exclusion is NOT done here: it is handled
 * by sendMarketingEmail() in src/lib/email.ts, which every recipient passes
 * through before sending. This resolver only answers "who matches the filter".
 */

export interface EntrySegmentFilter {
  /** Award ids (year). Required — at least one must be selected. */
  awardIds: number[];
  /** Entry.reviewStatus exact values to include: "" | "rejected" | "first_passed" | "second_passed".
   *  Empty array = no restriction on this axis. */
  reviewStatuses: string[];
  /** Entry.prizeLevel exact values to include: "" | "銅賞" | "銀賞" | "金賞" | "最高金賞".
   *  Empty array = no restriction on this axis. */
  prizeLevels: string[];
}

export interface EntrySegmentRecipient {
  email: string;
  name: string;
  company: string;
  /** All Entry ids (across the matched award(s)) that made this email match — for audit/debug. */
  matchedEntryIds: number[];
}

/**
 * Entry.reviewStatus is a comma-separated tag string (e.g. "first_passed,second_passed"
 * is possible for an entry that passed both stages). Selecting "1次審査通過" must match
 * ONLY entries whose status is *exactly* first_passed — not "at least reached" (that is
 * what the existing /reviews page's `contains` filter does; this is intentionally
 * different per the applicant-email spec: "累積・以上ではない").
 */
function reviewStatusMatches(raw: string, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const tags = raw ? raw.split(",").filter(Boolean) : [];
  if (tags.length === 0) return selected.includes("");
  return tags.length === 1 && selected.includes(tags[0]);
}

/** Entry.prizeLevel is a single value (not a tag list), so a plain exact-match works. */
function prizeLevelMatches(raw: string, selected: string[]): boolean {
  if (selected.length === 0) return true;
  return selected.includes(raw || "");
}

/**
 * Resolve the deduplicated recipient list for a segment filter.
 * any-match: if ANY of a person's entries (by email) satisfies the filter, they're included once.
 * When the same email has multiple matching entries, the most recently answered entry's
 * name/company is used for merge-tag personalization (deterministic tie-break).
 */
export async function resolveEntrySegment(
  filter: EntrySegmentFilter
): Promise<EntrySegmentRecipient[]> {
  if (!filter.awardIds || filter.awardIds.length === 0) return [];

  const candidates = await prisma.entry.findMany({
    where: { awardId: { in: filter.awardIds } },
    select: {
      id: true,
      email: true,
      companyName: true,
      contactLastName: true,
      contactFirstName: true,
      reviewStatus: true,
      prizeLevel: true,
      answeredAt: true,
    },
  });

  const matched = candidates.filter(
    (e) =>
      reviewStatusMatches(e.reviewStatus, filter.reviewStatuses) &&
      prizeLevelMatches(e.prizeLevel, filter.prizeLevels)
  );

  const byEmail = new Map<
    string,
    EntrySegmentRecipient & { _answeredAt: string }
  >();

  for (const e of matched) {
    const email = e.email?.trim().toLowerCase();
    if (!email) continue; // no-email entries are never sendable

    const existing = byEmail.get(email);
    if (!existing) {
      byEmail.set(email, {
        email,
        name: `${e.contactLastName || ""} ${e.contactFirstName || ""}`.trim(),
        company: e.companyName || "",
        matchedEntryIds: [e.id],
        _answeredAt: e.answeredAt,
      });
    } else {
      existing.matchedEntryIds.push(e.id);
      if (e.answeredAt > existing._answeredAt) {
        existing.name = `${e.contactLastName || ""} ${e.contactFirstName || ""}`.trim();
        existing.company = e.companyName || "";
        existing._answeredAt = e.answeredAt;
      }
    }
  }

  return [...byEmail.values()].map((r) => ({
    email: r.email,
    name: r.name,
    company: r.company,
    matchedEntryIds: r.matchedEntryIds,
  }));
}

/** Lightweight count for the live "対象人数" preview (no suppression check — see file header). */
export async function countEntrySegment(filter: EntrySegmentFilter): Promise<number> {
  const recipients = await resolveEntrySegment(filter);
  return recipients.length;
}
