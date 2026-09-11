"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Children, type ReactNode } from "react";
import type { Role } from "@/lib/role-shared";
import { PERMISSIONS } from "@/lib/role-shared";
import { cn } from "@/lib/cn";
import { Brand } from "@/components/ui/brand";
import { Avatar } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/ui/role-badge";
import { Button } from "@/components/ui/button";
import { Select, type SelectProps } from "@/components/ui/field-controls";
import { SiteSidebar } from "@/components/site-sidebar";
import { isSitePath } from "@/lib/site-nav";
import {
  LayoutDashboard,
  ClipboardList,
  Trophy,
  ClipboardCheck,
  BookUser,
  Target,
  FileText,
  Receipt,
  MailCheck,
  CalendarDays,
  Users,
  Settings,
  History,
  LogOut,
  Globe,
  type LucideIcon,
} from "@/components/ui/icons";

/* ------------------------------------------------------------ 小部品 */
/* ui/ には置かない（サイドバー以外で使わないため）。 */

type NavGroupKey = "daily" | "outreach" | "admin";

// 描画順。navItems 配列の順は維持したまま、group ごとに拾って見出し付きで並べる
const GROUPS: [NavGroupKey, string][] = [
  ["daily", "日常業務"],
  ["outreach", "配信・営業"],
  ["admin", "管理"],
];

/** 年度セレクト。全画面に効く切替なので通常の入力欄より一段強く（太字＋CalendarDays） */
function YearSelect(props: SelectProps) {
  return (
    <Select
      leadingIcon={<CalendarDays aria-hidden="true" />}
      className="font-semibold"
      {...props}
    />
  );
}

/** ナビの見出し。可視項目が 0 のグループは見出しごと出さない */
function NavGroup({ label, children }: { label: string; children: ReactNode }) {
  if (Children.toArray(children).length === 0) return null;
  return (
    <div className="mt-5 first:mt-0">
      <p className="px-3 mb-1 text-caption font-medium text-ink-subtle">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

/** ナビ項目。アクティブは白い面＋影＋太字＋アイコン黒＋aria-current で示す（青は使わない） */
function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-md px-3 text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        active
          ? "bg-surface text-ink font-medium shadow-xs"
          : "text-ink-muted hover:bg-surface hover:text-ink",
      )}
    >
      <Icon
        className={cn("size-4 shrink-0", active ? "text-ink" : "text-ink-subtle")}
        aria-hidden="true"
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/* ------------------------------------------------------------ Sidebar */

export function Sidebar({
  awards,
  role,
  userName,
}: {
  awards: { id: number; year: number; name: string }[];
  role: Role;
  userName: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentYear = searchParams.get("year") || (awards.length > 0 ? String(awards[0].year) : "");
  const perms = PERMISSIONS[role];

  // /site 配下（サイト管理）は専用のサイドバーに切り替える。layout で canManageSite を
  // 確認済みなので、ここに来るのはサイト管理を使える役割だけ
  if (isSitePath(pathname)) {
    return <SiteSidebar role={role} userName={userName} />;
  }

  function handleYearChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const year = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", year);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  function hrefWithYear(href: string) {
    return currentYear ? `${href}?year=${currentYear}` : href;
  }

  const navItems: {
    href: string;
    label: string;
    icon: LucideIcon;
    show: boolean;
    group: NavGroupKey;
  }[] = [
    { href: "/", label: "ダッシュボード", icon: LayoutDashboard, show: true, group: "daily" },
    { href: "/entries", label: "エントリー一覧", icon: ClipboardList, show: true, group: "daily" },
    { href: "/awards", label: "受賞一覧", icon: Trophy, show: true, group: "daily" },
    { href: "/reviews", label: "審査状況", icon: ClipboardCheck, show: true, group: "daily" },
    { href: "/contacts", label: "メール配信リスト", icon: BookUser, show: perms.canManageContacts, group: "outreach" },
    { href: "/prospects", label: "追客リスト", icon: Target, show: perms.canManageProspects, group: "outreach" },
    { href: "/forms", label: "フォーム", icon: FileText, show: perms.canManageForms, group: "outreach" },
    { href: "/invoices", label: "請求書", icon: Receipt, show: perms.canManageInvoices, group: "outreach" },
    { href: "/email-logs", label: "配信履歴", icon: MailCheck, show: role === "admin", group: "admin" },
    { href: "/award-settings", label: "年度管理", icon: CalendarDays, show: role === "admin", group: "admin" },
    { href: "/users", label: "ユーザー管理", icon: Users, show: role === "admin", group: "admin" },
    { href: "/settings", label: "設定", icon: Settings, show: role === "admin", group: "admin" },
    { href: "/logs", label: "操作ログ", icon: History, show: role === "admin", group: "admin" },
    { href: "/site", label: "サイト管理", icon: Globe, show: perms.canManageSite, group: "admin" },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 flex w-sidebar flex-col border-r border-line bg-surface-muted">
      {/* Brand（リンクにはしない。ダッシュボード遷移はナビ項目が担う） */}
      <div className="px-4 pt-5 pb-3">
        <Brand size="sm" />
      </div>

      {/* Year Selector */}
      {awards.length > 0 && (
        <div className="px-4 pb-4">
          <label
            htmlFor="sidebar-year"
            className="mb-1.5 flex items-center gap-1 text-caption font-medium text-ink-subtle"
          >
            開催年度
          </label>
          <YearSelect id="sidebar-year" value={currentYear} onChange={handleYearChange}>
            {awards.map((award) => (
              <option key={award.year} value={award.year}>
                {award.year}年度
              </option>
            ))}
          </YearSelect>
        </div>
      )}
      <div className="mx-4 h-px bg-line" />

      {/* Only the nav scrolls, so the user/logout block below stays reachable
          however many items are shown or however short the window is.
          min-h-0 is required: a flex item defaults to min-height:auto, which
          would let the nav outgrow the fixed h-screen aside and push the
          logout button off-screen instead of scrolling. */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-3">
        {GROUPS.map(([group, label]) => (
          <NavGroup key={group} label={label}>
            {navItems
              .filter((item) => item.group === group && item.show)
              .map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <NavItem
                    key={item.href}
                    href={hrefWithYear(item.href)}
                    label={item.label}
                    icon={item.icon}
                    active={isActive}
                  />
                );
              })}
          </NavGroup>
        ))}
      </nav>

      {/* User Info & Logout */}
      <div className="shrink-0 border-t border-line p-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5 min-w-0">
          <Avatar initial={userName.charAt(0).toUpperCase()} title={userName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink" title={userName}>
              {userName}
            </p>
            <RoleBadge role={role} size="sm" />
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 w-full justify-start"
          icon={<LogOut aria-hidden="true" />}
          onClick={handleLogout}
        >
          ログアウト
        </Button>
      </div>
    </aside>
  );
}
