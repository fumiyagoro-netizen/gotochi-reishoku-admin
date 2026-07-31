/**
 * Helper for formatting the timestamp stored in Entry.answeredAt.
 *
 * Entry.answeredAt is a plain String column (see prisma/schema.prisma), not
 * a DateTime — and it always needs to hold the JST "YYYY/MM/DD HH:mm:ss"
 * format, e.g. "2025/12/02 23:35:31". That's not an arbitrary style choice:
 * the 116 pre-existing entries were imported from the original Google-Forms
 * CSV export via src/lib/csv-parser.ts, which stores the form's own
 * "回答日時" column verbatim and already comes in exactly that format. New
 * web-form entries (src/app/api/entry/route.ts) must produce the identical
 * format so the two sources are indistinguishable once in the database.
 *
 * This matters beyond cosmetics: answeredAt is compared and sorted as a
 * plain string, not parsed as a date, in several places — the entries/
 * reviews pages' `orderBy: { answeredAt: "desc" }`, the Excel export's
 * orderBy, and the "which of this person's entries is most recent" string
 * comparison in src/lib/entry-mail.ts. Zero-padded "YYYY/MM/DD HH:mm:ss"
 * sorts correctly in plain dictionary order, so keeping every row in this
 * single, zero-padded format is what makes all of those string comparisons
 * behave like a real chronological sort. Mixing in ISO-8601 UTC strings
 * (e.g. "2026-07-31T20:38:50.358Z") breaks that: they don't sort correctly
 * against the JST format, and they display 9 hours off in JST-facing admin
 * screens.
 *
 * This is deliberately a separate file from src/lib/award-dates.ts, which
 * converts between "YYYY-MM-DD" <input type="date"> values and the UTC
 * Award.entryStartDate / Award.entryEndDate DateTime columns for the award
 * settings screen — a different data shape (calendar date vs. timestamp)
 * and a different column type (DateTime vs. String) with a different
 * purpose (defining a date range vs. formatting an application record's
 * timestamp for the CSV-compatible String column).
 *
 * Japan Standard Time has no daylight saving time (always UTC+9), so this
 * can rely directly on Intl's Asia/Tokyo formatting without any manual
 * offset arithmetic — including at JST midnight, which formats as
 * "00:00:00" rather than a 24:00:00-style rollover.
 */
export function formatAnsweredAtJst(date: Date = new Date()): string {
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
