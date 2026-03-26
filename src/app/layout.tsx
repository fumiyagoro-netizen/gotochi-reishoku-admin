import type { Metadata } from "next";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getPermissions } from "@/lib/role-shared";
import { RoleProvider } from "@/lib/role-context";
import { SidebarWrapper } from "@/components/sidebar-wrapper";

export const metadata: Metadata = {
  title: "ご当地冷凍食品大賞 管理システム",
  description: "エントリー管理・請求書発行・入金管理",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // Not logged in - render without sidebar (login page)
  if (!user) {
    return (
      <html lang="ja">
        <body className="bg-gray-50 min-h-screen">{children}</body>
      </html>
    );
  }

  const awards = await prisma.award.findMany({
    orderBy: { year: "desc" },
    select: { id: true, year: true, name: true },
  });

  return (
    <html lang="ja">
      <body className="bg-gray-50 min-h-screen">
        <RoleProvider role={user.role}>
          <div className="flex min-h-screen">
            <SidebarWrapper awards={awards} role={user.role} userName={user.email} />
            <main className="flex-1 ml-64">{children}</main>
          </div>
        </RoleProvider>
      </body>
    </html>
  );
}
