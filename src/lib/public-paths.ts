/**
 * Shared public-path matching logic.
 *
 * Used by:
 * - src/middleware.ts — decides which requests bypass the auth_token check.
 * - src/app/layout.tsx — decides which pages render without the admin
 *   sidebar (mirrors the pages under src/app/(public)/).
 *
 * IMPORTANT: always match on segment boundaries, never with a raw
 * `pathname.startsWith(prefix)`. A short prefix like "/entry" also matches
 * unrelated paths such as "/entries" (admin page) or "/api/entries/*"
 * (admin API) under plain startsWith, which previously let those admin
 * routes bypass auth entirely. Use matchesPathPrefix() below instead.
 */

/** Path prefixes that bypass auth in middleware (pages + APIs). */
export const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/entry",
  "/api/entry",
  "/results",
  "/api/images",
  "/favicon.ico",
  "/unsubscribe",
  "/api/unsubscribe",
  "/api/diag",
  "/api/ping",
  // Resend delivery-event webhook (src/app/api/webhooks/resend). It has no
  // session cookie to check — Resend calls it directly, unauthenticated by
  // this app's session system — so it must bypass the auth_token check here.
  // It is NOT unauthenticated overall: the route itself verifies every
  // request's Svix signature (svix-id/svix-timestamp/svix-signature against
  // RESEND_WEBHOOK_SECRET) before touching the database, and refuses with a
  // 500 if that secret isn't configured.
  "/api/webhooks",
];

/** Public form page: /f/<slug> */
export const PUBLIC_FORM_PATH = /^\/f(\/|$)/;

/** Public form submission API: /api/forms/<slug>/submit */
export const FORM_SUBMIT_PATH = /^\/api\/forms\/[^/]+\/submit$/;

/** Public form upload API: /api/forms/upload */
export const FORM_UPLOAD_PATH = /^\/api\/forms\/upload$/;

/**
 * Matches `pathname` against `prefix` on a segment boundary: either an
 * exact match, or `prefix` followed by "/". Prevents "/entry" from
 * matching "/entries".
 */
export function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Public UI page prefixes that render without the admin sidebar, mirroring
 * src/app/(public)/ (entry, entry/complete, results, unsubscribe). Keep in
 * sync with that directory. /f/<slug> is matched separately via
 * PUBLIC_FORM_PATH since it's a dynamic segment.
 */
const PUBLIC_PAGE_PATHS = ["/entry", "/results", "/unsubscribe"];

/**
 * True if `pathname` belongs to the `(public)` route group, i.e. should
 * never show the admin sidebar regardless of login state.
 */
export function isPublicPagePath(pathname: string): boolean {
  return (
    PUBLIC_PAGE_PATHS.some((p) => matchesPathPrefix(pathname, p)) ||
    PUBLIC_FORM_PATH.test(pathname)
  );
}
