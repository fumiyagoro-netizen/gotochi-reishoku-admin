/** Server-only role utilities */
import { getCurrentUser, getUserFromRequest as getUser } from "./auth";
export type { Role, Permissions } from "./role-shared";
export { ROLE_LABELS, ROLE_DESCRIPTIONS, PERMISSIONS, getPermissions } from "./role-shared";

import type { Role } from "./role-shared";

export async function getCurrentRole(): Promise<Role> {
  const user = await getCurrentUser();
  return user?.role ?? "viewer";
}

/** For use in API routes - read role from request cookie */
export async function getRoleFromRequest(request: Request): Promise<Role> {
  const payload = await getUser(request);
  if (payload?.role === "admin" || payload?.role === "editor" || payload?.role === "viewer") {
    return payload.role;
  }
  return "viewer";
}
