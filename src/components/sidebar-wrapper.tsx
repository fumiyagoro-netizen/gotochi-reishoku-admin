"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Brand } from "@/components/ui/brand";
import { Menu, X } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { Role } from "@/lib/role-shared";

/**
 * 左のメニュー。md（768px）以上は常に左に出し、それより狭い画面（スマホ）では
 * 上のバーの「メニュー」ボタンで左から引き出す。本文側の余白は layout.tsx の
 * md:pl-sidebar（横）と pt-14 md:pt-0（上のバーの高さ）が受け持つ。
 */
export function SidebarWrapper({
  awards,
  role,
  userName,
}: {
  awards: { id: number; year: number; name: string }[];
  role: Role;
  userName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // メニューから別の画面へ移ったら閉じる
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 開いている間は後ろの本文をスクロールさせず、Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {/* スマホだけの上のバー */}
      <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface/95 px-2 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="メニューを開く"
          aria-expanded={open}
          aria-controls="admin-sidebar"
          className="grid size-10 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <Brand size="sm" />
      </header>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" aria-hidden="true" onClick={() => setOpen(false)} />
      )}

      {/* 中の aside は fixed のまま。transform を持つこの枠の中では fixed が枠基準になるので、枠ごと動かせる */}
      <div
        id="admin-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-sidebar transition-transform duration-200 md:translate-x-0 md:transition-none",
          open ? "translate-x-0 shadow-xl" : "-translate-x-full",
        )}
      >
        {open && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="メニューを閉じる"
            className="absolute left-full top-2 ml-2 grid size-10 place-items-center rounded-md bg-surface text-ink shadow-md md:hidden"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        )}
        {/* Sidebar は useSearchParams を呼ぶので Suspense 境界が必要。
            サスペンド中も左 w-sidebar を面として保ち、本文（md:pl-sidebar）がずれないようにする。 */}
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
      </div>
    </>
  );
}
