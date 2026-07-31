/**
 * Helpers for converting between the plain "YYYY-MM-DD" calendar date
 * strings produced by <input type="date"> in the 年度管理 (award settings)
 * admin UI and the UTC instants stored in Award.entryStartDate /
 * Award.entryEndDate.
 *
 * Why this is needed: `new Date("YYYY-MM-DD")` parses the string as UTC
 * midnight, not Japan midnight. Since the admin is picking a date in Japan
 * time, that naive parse is 9 hours off — e.g. `new Date("2026-08-01")` is
 * 2026-08-01T00:00:00Z, which is already 2026-08-01 09:00 in Japan, so the
 * entry period would open 9 hours late (and a deadline would cut off 9
 * hours early, losing almost the entire last day).
 *
 * Japan Standard Time has no daylight saving time, so it's always exactly
 * UTC+9. That means we can convert correctly and simply by appending a
 * fixed "+09:00" offset to the date string instead of pulling in a
 * timezone library.
 */

const JST_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converts a "YYYY-MM-DD" calendar date into the UTC instant for
 * 00:00:00.000 JST on that day, i.e. the moment the entry period should
 * start opening the day the admin selected.
 * Returns `null` for empty/missing/malformed input (including anything
 * that would otherwise parse to an Invalid Date), so callers can store
 * `null` instead of an Invalid Date.
 */
export function jstDateStringToStartOfDayUtc(dateStr: string | null | undefined): Date | null {
  if (!dateStr || !JST_DATE_RE.test(dateStr)) return null;
  const date = new Date(`${dateStr}T00:00:00+09:00`);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Converts a "YYYY-MM-DD" calendar date into the UTC instant for
 * 23:59:59.999 JST on that day, so the deadline day itself stays open for
 * entries until it actually ends in Japan time (rather than closing at the
 * very start of that day).
 * Returns `null` for empty/missing/malformed input, same as
 * `jstDateStringToStartOfDayUtc`.
 */
export function jstDateStringToEndOfDayUtc(dateStr: string | null | undefined): Date | null {
  if (!dateStr || !JST_DATE_RE.test(dateStr)) return null;
  const date = new Date(`${dateStr}T23:59:59.999+09:00`);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Extracts the "YYYY-MM-DD" JST calendar date from a stored UTC instant
 * (Date object, or ISO string as received from a JSON API response), for
 * pre-filling an <input type="date">.
 *
 * Just slicing the first 10 characters off an ISO string is wrong here:
 * a start date of 2026-08-01 is stored as 2026-07-31T15:00:00.000Z (see
 * `jstDateStringToStartOfDayUtc`), whose first 10 characters are
 * "2026-07-31" — one day off from what the admin originally entered.
 */
export function utcToJstDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return "";
  // en-CA formats as YYYY-MM-DD, which is exactly the <input type="date"> value format.
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}
