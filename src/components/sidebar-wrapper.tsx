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
    // Sidebar は useSearchParams を呼ぶので Suspense 境界が必要。
    // サスペンド中も左 w-sidebar を面として保ち、本文（pl-sidebar）がずれないようにする。
    <Suspense
      fallback={
        <aside
          className="fixed inset-y-0 left-0 w-sidebar border-r border-line bg-surface-muted"
          aria-hidden="true"
        />
      }
    >
      <Sidebar awards={awards} role={role} userName={userName} />
    </Suspense>
  );
}
