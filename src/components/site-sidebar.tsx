"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/role-shared";
import { ROLE_LABELS } from "@/lib/role-shared";
import { SITE_NAV, isSiteNavActive, type SiteNavItem } from "@/lib/site-nav";
import { cn } from "@/lib/cn";
import { ArrowLeft, ExternalLink, LogOut } from "@/components/ui/icons";

/*
 * サイト管理（/site 配下）のサイドバー。通常の Sidebar から切り替わる。
 * 面は紺（tailwind の site-*）で、エントリー管理とは別の区画にいることを示す。
 * 寸法（w-sidebar・h-9 の項目・見出しの caption）は通常の Sidebar に合わせる。
 */

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/60";

// 現行の公開サイト（WordPress）。新しい公開サイトに切り替えたらそちらを指す
const PUBLIC_SITE_URL = "https://gotouchireisyoku.com/";

function SiteNavLink({ item, active }: { item: SiteNavItem; active: boolean }) {
  const Icon = item.icon;
  if (!item.ready) {
    return (
      <span
        aria-disabled="true"
        title="準備中（まだ画面がありません）"
        className="flex h-9 cursor-not-allowed items-center gap-2.5 rounded-md px-3 text-sm text-site-subtle"
      >
        <Icon className="size-4 shrink-0 opacity-60" aria-hidden="true" />
        <span className="truncate">{item.label}</span>
        <span className="ml-auto shrink-0 text-caption">準備中</span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-md px-3 text-sm transition-colors",
        FOCUS,
        active ? "bg-site-active font-medium text-white" : "text-site-ink hover:bg-site-hover hover:text-white",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-site-accent" : "text-site-subtle")} aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function SiteSidebar({ role, userName }: { role: Role; userName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="fixed inset-y-0 left-0 flex w-sidebar flex-col bg-site text-site-ink">
      <div className="px-4 pt-4">
        <Link
          href="/"
          className={cn("inline-flex items-center gap-1 rounded-md text-caption text-site-subtle transition-colors hover:text-white", FOCUS)}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          エントリー管理に戻る
        </Link>
        <div className="mt-4 flex items-center gap-2.5">
          {/* 公開サイトのマーク（青→シアンの角丸に白い菱形）と同じ形 */}
          <span aria-hidden="true" className="relative size-[30px] shrink-0 rounded-[9px] bg-gradient-to-br from-site-blue to-site-accent">
            <span className="absolute inset-[9px] rotate-45 rounded-[2px] bg-white/95" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold text-white">ご当地冷凍食品大賞</p>
            <p className="text-caption font-semibold tracking-[0.16em] text-site-accent">SITE ADMIN</p>
          </div>
        </div>
      </div>

      <a
        href={PUBLIC_SITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="現行の公開サイト（WordPress）を新しいタブで開く"
        className={cn(
          "mx-4 mt-4 flex items-center gap-2 rounded-md border border-site-line px-2.5 py-2 text-caption transition-colors hover:bg-site-hover",
          FOCUS,
        )}
      >
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-emerald-400" />
        <span className="min-w-0 flex-1 truncate">gotouchireisyoku.com</span>
        <ExternalLink className="size-3.5 shrink-0 text-site-subtle" aria-hidden="true" />
      </a>

      {/* 通常の Sidebar と同じく、nav だけスクロールさせて下のユーザー欄を常に見せる（min-h-0 が必要） */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3" aria-label="サイト管理">
        {SITE_NAV.map((group) => (
          <div key={group.label} className="mt-5 first:mt-0">
            <p className="mb-1 px-3 text-caption font-medium text-site-subtle">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SiteNavLink key={item.href} item={item} active={isSiteNavActive(pathname, item.href)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-site-line p-3">
        <div className="flex min-w-0 items-center gap-2.5 px-2 py-1.5">
          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-full bg-white/15 text-caption font-semibold text-white"
          >
            {userName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-white" title={userName}>
              {userName}
            </p>
            <p className="text-caption text-site-subtle">{ROLE_LABELS[role] ?? role}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            "mt-1 flex h-8 w-full items-center gap-1.5 rounded-md px-3 text-caption font-medium text-site-ink transition-colors hover:bg-site-hover hover:text-white",
            FOCUS,
          )}
        >
          <LogOut className="size-4" aria-hidden="true" />
          ログアウト
        </button>
      </div>
    </aside>
  );
}
