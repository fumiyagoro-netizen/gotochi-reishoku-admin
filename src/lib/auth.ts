/** Server-side auth utilities */
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import type { Role } from "./role-shared";

// Re-export core utilities
export { verifyToken, createToken, COOKIE_NAME, TOKEN_MAX_AGE } from "./auth-core";
export type { TokenPayload } from "./auth-core";
import { verifyToken, COOKIE_NAME } from "./auth-core";
import type { TokenPayload } from "./auth-core";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Verifies a JWT's signature/expiry, then re-checks the user's isActive
 * status and current role against the DB. A signed token stays valid for
 * up to TOKEN_MAX_AGE (7 days) on its own, but a role change or account
 * deactivation must take effect immediately (e.g. an admin demoting or
 * disabling a departing staff member) — so every caller re-derives the
 * role from the DB instead of trusting the token payload's role.
 */
async function verifyAndRefreshUser(token: string): Promise<TokenPayload | null> {
  const payload = await verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, isActive: true, role: true },
  });

  if (!user || !user.isActive) return null;

  return { ...payload, role: user.role as Role };
}

/** Get current user from cookie - server components only */
export async function getCurrentUser(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  return verifyAndRefreshUser(token);
}

// Cached version - use in layouts to avoid repeated DB calls in same request
import { cache } from "react";
export const getCachedCurrentUser = cache(getCurrentUser);

/**
 * Per-request memoization for getUserFromRequest, keyed by Request object
 * identity. API routes routinely call getUserFromRequest (audit-log actor)
 * and getRoleFromRequest (permission check — itself implemented in terms of
 * getUserFromRequest, see src/lib/role.ts) more than once for the same
 * incoming request. React's cache() from getCachedCurrentUser above is
 * scoped for the Server Component render tree (used by cookies()-based
 * getCurrentUser), not guaranteed for Route Handlers reading from a plain
 * Request, so we memoize explicitly here instead: the exact same Request
 * instance is threaded through a single handler invocation, so a WeakMap
 * keyed on it gives exactly one DB round-trip per incoming request no
 * matter how many call sites ask for it, and the entry is garbage
 * collected automatically once the request finishes (no manual cleanup,
 * no cross-request leakage).
 */
const requestUserCache = new WeakMap<Request, Promise<TokenPayload | null>>();

/**
 * Get user from request cookie - API routes.
 *
 * Applies the same DB-backed isActive/role check as getCurrentUser (see
 * verifyAndRefreshUser above), so a deactivated or demoted user's
 * still-cryptographically-valid cookie is rejected here too. This is what
 * getRoleFromRequest (src/lib/role.ts) builds on for API permission checks,
 * and what a few routes (e.g. /api/users) also use directly for admin-only
 * gating and for the userId/email recorded in audit logs.
 */
export function getUserFromRequest(request: Request): Promise<TokenPayload | null> {
  const cached = requestUserCache.get(request);
  if (cached) return cached;

  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  const result = match ? verifyAndRefreshUser(match[1]) : Promise.resolve(null);

  requestUserCache.set(request, result);
  return result;
}
