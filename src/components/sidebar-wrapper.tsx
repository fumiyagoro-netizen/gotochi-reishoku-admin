"use client";

import { Suspense } from "react";
import { Sidebar } from "./sidebar";
import type { Role } from "@/lib/role-shared";

export function SidebarWrapper({
  awards,
  role,
  userName,
}: {
  awards: { id: number; year: number; name: string }[];
  role: Role;
  userName: string;
}) {
  return (
    <Suspense>
      <Sidebar awards={awards} role={role} userName={userName} />
    </Suspense>
  );
}
