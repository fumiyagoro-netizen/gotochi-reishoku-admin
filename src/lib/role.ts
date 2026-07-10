/** Server-only role utilities */
import { getCachedCurrentUser, getUserFromRequest as getUser } from "./auth";
export type { Role, Permissions } from "./role-shared";
export { ROLE_LABELS, ROLE_DESCRIPTIONS, PERMISSIONS, getPermissions } from "./role-shared";

import { PERMISSIONS, type Role } from "./role-shared";

// Validate against the PERMISSIONS key set instead of a hardcoded literal
// list, so adding a new Role to role-shared.ts can never silently leave this
// check out of sync (a role missing here falls back to "viewer" in every API
// route, even though the DB/page-level role is correct — easy to miss).
function isKnownRole(value: unknown): value is Role {
  return typeof value === "string" && value in PERMISSIONS;
}

export async function getCurrentRole(): Promise<Role> {
  const user = await getCachedCurrentUser();
  return user?.role ?? "viewer";
}

/** For use in API routes - read role from request cookie */
export async function getRoleFromRequest(request: Request): Promise<Role> {
  const payload = await getUser(request);
  if (isKnownRole(payload?.role)) {
    return payload.role;
  }
  return "viewer";
}
