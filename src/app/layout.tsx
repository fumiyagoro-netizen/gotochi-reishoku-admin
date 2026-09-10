import type { Metadata } from "next";
import "./globals.css";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCachedCurrentUser } from "@/lib/auth";
import { RoleProvider } from "@/lib/role-context";
import { SidebarWrapper } from "@/components/sidebar-wrapper";
import { isPublicPagePath } from "@/lib/public-paths";

export const metadata: Metadata = {
  title: {
    default: "ご当地冷凍食品大賞 管理システム",
    template: "%s | ご当地冷凍食品大賞",
  },
  description: "エントリー管理・請求書発行・入金管理",
};

// 公開ページ（(public) 配下）にも効くので値は変えない。管理画面の見た目は
// RoleProvider 直下の .admin-shell（globals.css）が担う。
const BODY_CLASS = "bg-gray-50 min-h-screen";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";

  const user = await getCachedCurrentUser();

  // Public pages (src/app/(public)/*, e.g. /f/<slug>, /entry, /results,
  // /unsubscribe) never show the admin sidebar, regardless of login state.
  // Not logged in - render without sidebar (login page)
  if (isPublicPagePath(pathname) || !user) {
    return (
      <html lang="ja">
        <body className={BODY_CLASS}>{children}</body>
      </html>
    );
  }

  const awards = await prisma.award.findMany({
    orderBy: { year: "desc" },
    select: { id: true, year: true, name: true },
  });

  return (
    <html lang="ja">
      <body className={BODY_CLASS}>
        <RoleProvider role={user.role}>
          <div className="admin-shell flex min-h-screen">
            <SidebarWrapper awards={awards} role={user.role} userName={user.email} />
            {/* サイドバーは fixed なので、幅 spacing.sidebar と同じ pl-sidebar で本文を逃がす。
                min-w-0 は幅広テーブルで main が横にはみ出さないため */}
            <main className="flex-1 pl-sidebar min-w-0">{children}</main>
          </div>
        </RoleProvider>
      </body>
    </html>
  );
}
