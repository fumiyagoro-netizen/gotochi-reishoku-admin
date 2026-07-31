"use client";

import { createContext, useContext } from "react";
import type { Role, Permissions } from "./role-shared";
import { PERMISSIONS } from "./role-shared";

interface RoleContextValue {
  role: Role;
  permissions: Permissions;
}

// Fail-secure default: if a component ever renders outside RoleProvider
// (e.g. missed wiring, test render), it must not silently behave as admin.
// In normal operation layout.tsx always wraps authenticated pages in
// RoleProvider with the DB-verified role, so this fallback should never
// actually be exercised.
const RoleContext = createContext<RoleContextValue>({
  role: "viewer",
  permissions: PERMISSIONS.viewer,
});

export function RoleProvider({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  return (
    <RoleContext.Provider value={{ role, permissions: PERMISSIONS[role] }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
