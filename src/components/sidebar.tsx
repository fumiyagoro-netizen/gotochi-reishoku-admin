"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import type { Role } from "@/lib/role-shared";
import { ROLE_LABELS, PERMISSIONS } from "@/lib/role-shared";

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

  const navItems = [
    { href: "/", label: "ダッシュボード", icon: "📊", show: true },
    { href: "/entries", label: "エントリー一覧", icon: "📋", show: true },
    { href: "/awards", label: "受賞一覧", icon: "🏆", show: true },
    { href: "/reviews", label: "審査状況", icon: "✅", show: true },
    { href: "/upload", label: "CSVアップロード", icon: "📁", show: perms.canUpload },
    { href: "/award-settings", label: "年度管理", icon: "📅", show: role === "admin" },
    { href: "/users", label: "ユーザー管理", icon: "👥", show: role === "admin" },
    { href: "/logs", label: "操作ログ", icon: "📝", show: role === "admin" },
  ];

  const roleColors: Record<Role, string> = {
    admin: "bg-red-100 text-red-700",
    editor: "bg-blue-100 text-blue-700",
    viewer: "bg-gray-100 text-gray-600",
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-900 leading-tight">
          ご当地冷凍食品大賞
        </h1>
        <p className="text-xs text-gray-500 mt-1">管理システム</p>
      </div>

      {/* Year Selector */}
      {awards.length > 0 && (
        <div className="px-4 pt-4 pb-2">
          <label className="block text-xs text-gray-500 mb-1.5">開催年度</label>
          <select
            value={currentYear}
            onChange={handleYearChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            {awards.map((award) => (
              <option key={award.year} value={award.year}>
                {award.year}年度
              </option>
            ))}
          </select>
        </div>
      )}

      <nav className="flex-1 p-4 space-y-1">
        {navItems
          .filter((item) => item.show)
          .map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={hrefWithYear(item.href)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 truncate">{userName}</p>
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${roleColors[role]}`}>
              {ROLE_LABELS[role]}
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg
            hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          ログアウト
        </button>
      </div>
    </aside>
  );
}
