"use client";

import { createContext, useContext } from "react";
import type { Role, Permissions } from "./role-shared";
import { PERMISSIONS } from "./role-shared";

interface RoleContextValue {
  role: Role;
  permissions: Permissions;
}

const RoleContext = createContext<RoleContextValue>({
  role: "admin",
  permissions: PERMISSIONS.admin,
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
